// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

/**
 * Author: ThomasSchilder
 *
 * This smart contract contains a decentralized engine for scientific workflow execution.
 * The engine is based on a Petri net model. Inspiration for this approach comes from:
 *
 * Cushing, R., Zhou, X., Belloum, A., Grosso, P., Van Engers, T., & De Laat, C. (2023, 1 november).
 * Enabling Collaborative Multi-Domain Applications: A Blockchain-Based Solution with Petri Net Workflow Modeling and Incentivization.
 * https://doi.org/10.1109/tps-isa58951.2023.00036
 *
 */

contract WorkflowEngine {

    enum State { CREATED, SCHEDULED, CLAIMED, AWAIT_USER_INPUT, RUNNING, COMPLETED, FAILED, SKIPPED }
    enum ArcType { INPUT, OUTPUT }
    enum VarType { STRING, NUMBER, BOOLEAN, ADDRESS, CID }

    struct Arc {
        uint16 transitionId;
        uint16 placeId;
        uint16 weight;
        ArcType arcType;
    }
    struct Transition {
        uint16 transitionId;
        State state;
        address claimedBy;
        // Create CID storage for image/metadata
        bytes imageCID;
        bytes metadataCID;
    }
    struct Variable {
        uint16 varId;
        VarType varType;
        bytes value;
    }
    struct Instance {
        address owner;
        uint64 workflowId;
        // Array of all places in the workflow: Note that we mostly use the place id for mappings
        uint16[] placeIds;
        mapping (uint16 => bool) places;
        // Array of all transitions in the workflow: Note that we mostly use the transition ids for mappings
        uint16[] transitionIds;
        mapping(uint16 => Transition) transitions;
        // Mapping transition id to place (either input or output) and store weight for arcs
        mapping(uint16 => Arc[]) arcs;
        // Set initial marking: place id to token count
        mapping(uint16 => uint16) marking;
        // Set finalPlace
        mapping(uint16 => bool) finalPlaces;
    }

    // Events
    event WorkflowCreated(uint64 indexed workflowId, address indexed owner);
    event TaskSetScheduled(uint64 indexed workflowId, uint16 indexed transitionId, bytes imageCID, bytes metadataCID);
    event TaskSetClaimed(uint64 indexed workflowId, uint16 indexed transitionId, address claimedBy);
    event TaskSetSkipped(uint64 indexed workflowId, uint16 indexed transitionId);
    event TaskSetCompleted(uint64 indexed workflowId, uint16 indexed transitionId, address completedBy);

    // Errors
    error InvalidPlaceMarkings(uint16[] places, uint16[] weights);
    error DuplicatePlaceIdFound(uint16 place);
    error PlaceDoesNotExist(uint16 place);
    error DuplicateTransitionIdFound(uint16 transitionId);
    error TaskUnclaimable(uint64 workflowId, uint16 transitionId);
    error TaskWasAlreadyClaimed(uint64 workflowId, uint16 transitionId, address claimedBy);
    error TaskReserved(uint64 workflowId, uint16 transitionId, address claimedBy);
    error CompletionNotAllowed(uint64 workflowId, uint16 transitionId);
    error TaskSkipped(uint64 workflowId, uint16 transitionId);

    // Public state variables
    mapping(uint64 => Instance) public workflowInstances;
    uint64 public incrementalId = 0;


    /**
     * A function to create workflow instances.
     */
    function createWorkflow(uint16[] calldata places,  Transition[] calldata transitions, Arc[] calldata arcs, uint16[] calldata initialMarking, uint16[] calldata finalPlaces) external {
        // Generate unique workflow id
        incrementalId++;

        Instance storage inst = workflowInstances[incrementalId];
        inst.owner = msg.sender;
        inst.workflowId = incrementalId;

        createInitialMarking(inst, places, initialMarking);
        createTransitions(inst, transitions);
        createArcs(inst, arcs);
        setFinalPlaces(inst, finalPlaces);

        emit WorkflowCreated(incrementalId, msg.sender);

        updateInstanceState(incrementalId);
    }
    /**
     * A function to create the initial marking. The initial marking also shows all available places.
     */
    function createInitialMarking(Instance storage inst, uint16[] calldata places, uint16[] calldata marking) internal {
        if (places.length != marking.length) revert InvalidPlaceMarkings(places, marking);

        for (uint i = 0; i < places.length; i++) {
            if (inst.places[places[i]] == true) revert DuplicatePlaceIdFound(places[i]);
            inst.places[places[i]] = true;
            inst.placeIds.push(places[i]);
            // Set initial token count for place
            inst.marking[places[i]] = marking[i];
        }
    }
    /**
     * A function to create transitions based on user configured tasks.
     */
    function createTransitions(Instance storage inst, Transition[] calldata transitions) internal {
        for (uint i = 0; i < transitions.length; i++) {
            // Set transition in instance
            Transition memory transition = transitions[i];
            inst.transitionIds.push(transition.transitionId);
            inst.transitions[transition.transitionId] = Transition({
                transitionId: transition.transitionId,
                state: State.CREATED,
                claimedBy: transition.claimedBy,
                imageCID: transition.imageCID,
                metadataCID: transition.metadataCID
            });
        }
    }

    /**
     * A function to create input transitions.
     */
    function createArcs(Instance storage inst, Arc[] calldata arcs) internal {
        for (uint i = 0; i < arcs.length; i++) {
            if (inst.places[arcs[i].placeId] == false) revert PlaceDoesNotExist(arcs[i].placeId);
            // if (inst.transitions[arcs[i].transitionId].transitionId != arcs[i].transitionId) revert TransitionDoesNotExist(arcs[i].transitionId);
            Arc[] storage oa = inst.arcs[arcs[i].transitionId];
            oa.push(Arc({
                transitionId: arcs[i].transitionId,
                placeId: arcs[i].placeId,
                weight: arcs[i].weight,
                arcType: arcs[i].arcType
            }));
        }
    }
    /**
     * Function to set final places for workflow
     */
    function setFinalPlaces(Instance storage inst, uint16[] calldata finalPlaces) internal {
        for (uint16 i= 0; i<finalPlaces.length; i++) {
            inst.finalPlaces[finalPlaces[i]] = true;
        }
    }
    /**
     * A function to update the state of the workflow instance.
     *  - Checks which transitions are enabled based on the current marking.
     *  - Change transition state
     */
    function updateInstanceState(uint64 workflowId) internal {
        Instance storage inst = workflowInstances[workflowId];
        for (uint16 i = 0; i < inst.transitionIds.length; i++) {
            uint16 transitionId = inst.transitionIds[i];

            // Check if transition is enabled
            bool enabled = checkIfTransitionIsEnabled(inst, transitionId);

            // If enabled value is still true:
            if (enabled == true) {
                inst.transitions[transitionId].state = State.SCHEDULED;
                Transition memory transition = inst.transitions[transitionId];
                transition.state = State.SCHEDULED;
                emit TaskSetScheduled(workflowId, transitionId, transition.imageCID, transition.metadataCID);
            }
        }
    }
    /**
     * Checks for one transition whether the input place contains sufficient tokens
     */
    function checkIfTransitionIsEnabled(Instance storage inst, uint16 transitionId) internal view returns(bool enabled) {
        Arc[] memory transitionArcs = inst.arcs[transitionId];
        enabled = true;
        // Check for each arc if the tokens in the place is higher than the weight of the arc
        for (uint16 j; j< transitionArcs.length; j++) {
            // Only check input arcs
            if (transitionArcs[j].arcType == ArcType.OUTPUT) {
                continue;
            }
            uint16 placeId = transitionArcs[j].placeId;
            uint16 placeMarking = inst.marking[placeId];
            uint16 requiredWeight = transitionArcs[j].weight;
            if (placeMarking < requiredWeight) {
                enabled = false;
            }
            // Once enabled is false: the function can return.
            if (enabled == false) {
                break;
            }
        }
        return enabled;
    }
    /**
     * Function for claiming task. This implementation allows workers to claim tasks to ensure that
     * every task is executed exactly once. Reason for choosing this mechanism is to prevent multiple
     * workers execute the same task. This function:
     * - Checks if task can still be claimed
     * - Deducts tokens from input place
     * - updates state on transition.
     */
    function claimTask(uint64 workflowId, uint16 transitionId) external {
        Instance storage inst = workflowInstances[workflowId];
        Transition storage transition =  workflowInstances[workflowId].transitions[transitionId];
        if (transition.state == State.CLAIMED) revert TaskWasAlreadyClaimed(workflowId, transitionId, transition.claimedBy);
        if (transition.claimedBy != address(0) && transition.claimedBy != msg.sender) revert TaskReserved(workflowId, transitionId, transition.claimedBy);
        if (transition.state != State.SCHEDULED) revert TaskUnclaimable(workflowId, transitionId);

        // Check if input places can still be claimed: not necessarily the case (XOR cases)
        bool claimable = checkIfTransitionIsEnabled(inst, transitionId);
        if (claimable == false) {
            // Task was SCHEDULED, but no longer claimable: set to SKIPPED
            transition.state = State.SKIPPED;
            emit TaskSetSkipped(workflowId, transitionId);
            revert TaskSkipped(workflowId, transitionId);
        }
        // If not claimed: CLAIM TASK!
        transition.state = State.CLAIMED;
        transition.claimedBy = msg.sender;
        emit TaskSetClaimed(workflowId, transitionId, transition.claimedBy);
    }
    /**
     * On task completion, this function triggers a transition firing:
     * - Checks if the person is allowed to fire a transition: did they claim the transition?
     * - Updates the marking based on the output arcs of the transition
     * - Updates the state of the workflow instance to enable new transitions.
     */
    function completeTask(uint64 workflowId, uint16 transitionId) external {
        Instance storage inst = workflowInstances[workflowId];
        Transition storage transition =  inst.transitions[transitionId];
        if (transition.claimedBy != msg.sender) revert CompletionNotAllowed(workflowId, transitionId);

        // Fire task: update state +increment marking on all output places
        transition.state = State.COMPLETED;
        emit TaskSetCompleted(workflowId, transitionId, msg.sender);

        // Update output places using arcs
        Arc[] memory workflowArcs = inst.arcs[transitionId];
        for (uint16 i; i < workflowArcs.length; i++) {
            Arc memory arc = workflowArcs[i];
            // Only check output arcs
            if (arc.arcType == ArcType.INPUT) {
                continue;
            }
            // Update output place
            uint16 placeId = arc.placeId;
            inst.marking[placeId] = inst.marking[placeId] + arc.weight;
        }
        // Enable new transitions based on new marking.
        updateInstanceState(workflowId);
    }

    /** ------------------------------------------------------------------------------------------------
     *
     *
     * Underneath this comment, a collection of getter functions to retrieve workflow instance details
     * is provided. These functions are used for testing the contract and for interaction with off-chain
     * worker nodes.
     *
     *
     * ------------------------------------------------------------------------------------------------
     */

    /**
     * Getter function to retrieve all places in a given workflow instance.
     */
    function getPlaces(uint64 workflowId) external view returns (uint16[] memory workflowPlaces) {
        workflowPlaces = new uint16[](workflowInstances[workflowId].placeIds.length);
        for (uint i = 0; i < workflowInstances[workflowId].placeIds.length; i++) {
            workflowPlaces[i] = workflowInstances[workflowId].placeIds[i];
        }
        return workflowPlaces;
    }
    /**
     * Getter function to retrieve all transitions in a given workflow instance.
     */
    function getWorkflowTransitions(uint64 workflowId) external view returns (Transition[] memory transitions) {
        transitions = new Transition[](workflowInstances[workflowId].transitionIds.length);
        for (uint i=0; i< workflowInstances[workflowId].transitionIds.length; i++) {
            uint16 tId = workflowInstances[workflowId].transitionIds[i];
            transitions[i] = workflowInstances[workflowId].transitions[tId];
        }
        return transitions;
    }
    /**
     * Getter function to retrieve a specific transition using workflowId and transitionId.
     */
    function getWorkflowTransitionById(uint64 workflowId, uint16 transitionId) external view returns (Transition memory transition) {
        return workflowInstances[workflowId].transitions[transitionId];
    }
    /**
     * Getter function to retrieve all input arcs in a given workflow instance.
     */
    function getWorkflowArcs(uint64 workflowId) external view returns (Arc[] memory arcs) {
        uint16 arcLength = 0;
        for (uint16 i = 0; i < workflowInstances[workflowId].transitionIds.length; i++) {
            uint16 transitionId = workflowInstances[workflowId].transitionIds[i];
            arcLength = uint16(arcLength + workflowInstances[workflowId].arcs[transitionId].length);
        }
        arcs = new Arc[](arcLength);
        uint16 currentIndex = 0;
        for (uint16 i = 0; i < workflowInstances[workflowId].transitionIds.length; i++) {
            uint16 transitionId = workflowInstances[workflowId].transitionIds[i];
            Arc[] storage workflowArcs = workflowInstances[workflowId].arcs[transitionId];
            for (uint j = 0; j < workflowArcs.length; j++) {
                arcs[currentIndex] = workflowArcs[j];
                currentIndex++;
            }
        }
        return arcs;
    }
    /**
     * Getter function to retrieve the current marking of a given workflow instance.
     */
    function getMarking(uint64 workflowId) external view returns (uint16[] memory places, uint16[] memory marking) {
        places = workflowInstances[workflowId].placeIds;
        marking = new uint16[](workflowInstances[workflowId].placeIds.length);
        for (uint16 i = 0; i < workflowInstances[workflowId].placeIds.length; i++) {
            uint16 placeId = workflowInstances[workflowId].placeIds[i];
            marking[i] = workflowInstances[workflowId].marking[placeId];
        }
    }

    /**
     * Getter function to check if place is final
     */
    function isFinalPlace(uint64 workflowId, uint16 placeId) external view returns(bool isFinal) {
        return workflowInstances[workflowId].finalPlaces[placeId] == true;
    }


}

