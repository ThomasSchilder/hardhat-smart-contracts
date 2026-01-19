// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

/**
 * This smart contract contains a decentralized engine for scientific workflow execution.
 * The engine is based on a Petri net model. Inspiration for this approach comes from:
 *
 * Cushing, R., Zhou, X., Belloum, A., Grosso, P., Van Engers, T., & De Laat, C. (2023, 1 november).
 * Enabling Collaborative Multi-Domain Applications: A Blockchain-Based Solution with Petri Net Workflow Modeling and Incentivization.
 * https://doi.org/10.1109/tps-isa58951.2023.00036
 */

contract WorkflowEngine {

    enum State { CREATED, SCHEDULED, RUNNING, COMPLETED, FAILED }

    struct InputArc {
        uint16 placeId;
        uint16 transitionId;
        uint16 weight;
    }
    struct OutputArc {
        uint16 transitionId;
        uint16 placeId;
        uint16 weight;
    }
    struct Transition {
        uint16 transitionId;
        State state;
        // Create CID storage for image/metadata
        bytes imageCID;
        bytes metadataCID;
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
        // Mapping place id to Transition (+ weight) for input Arcs
        mapping(uint16 => InputArc[]) inputArcs;
        // Mapping Transition id to Transition (+ weight) for output Arcs
        mapping(uint16 => OutputArc[]) outputArcs;
        // Set initial marking: place id to token count
        mapping(uint16 => uint16) marking;
    }

    event WorkflowCreated(uint64 indexed workflowId, address indexed owner);
    event TaskScheduled(uint64 indexed workflowId, uint16 indexed transitionId, bytes imageCID, bytes inputCID, bytes metadataCID);

    error InvalidPlaceMarkings(uint16[] places, uint16[] weights);
    error DuplicatePlaceIdFound(uint16 place);
    error PlaceDoesNotExist(uint16 place);
    error DuplicateTransitionIdFound(uint16 transitionId);

    mapping(uint64 => Instance) public workflowInstances;
    uint64 public incrementalId = 0;


    /**
     * A function to create workflow instances.
     */
    function createWorkflow(uint16[] calldata places,  Transition[] calldata transitions, InputArc[] calldata inputArcs, OutputArc[] calldata outputArcs, uint16[] calldata initialMarking) external {
        // Generate unique workflow id
        incrementalId++;

        Instance storage inst = workflowInstances[incrementalId];
        inst.owner = msg.sender;
        inst.workflowId = incrementalId;

        createInitialMarking(inst, places, initialMarking);
        createTransitions(inst, transitions);
        createArcs(inst, inputArcs, outputArcs);

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
            inst.transitionIds.push(transitions[i].transitionId);
            inst.transitions[transitions[i].transitionId] = Transition({
                transitionId: transitions[i].transitionId,
                state: State.CREATED,
                imageCID: transitions[i].imageCID,
                metadataCID: transitions[i].metadataCID
            });
        }
    }

    /**
     * A function to create input transitions.
     */
    function createArcs(Instance storage inst, InputArc[] calldata inputArcs, OutputArc[] calldata outputArcs) internal {
        for (uint i = 0; i < inputArcs.length; i++) {
            if (inst.places[inputArcs[i].placeId] == false) revert PlaceDoesNotExist(inputArcs[i].placeId);
            // Very careful: placeId is used as key for inputArcs mapping.
            InputArc[] storage ia = inst.inputArcs[inputArcs[i].placeId];
            ia.push(InputArc({
                placeId: inputArcs[i].placeId,
                transitionId: inputArcs[i].transitionId,
                weight: inputArcs[i].weight
            }));
        }

        for (uint i = 0; i < outputArcs.length; i++) {
            if (inst.places[outputArcs[i].placeId] == false) revert PlaceDoesNotExist(outputArcs[i].placeId);
            // Very careful: transitionId is used as key for outputArcs mapping.
            OutputArc[] storage oa = inst.outputArcs[outputArcs[i].transitionId];
            oa.push(OutputArc({
                placeId: outputArcs[i].placeId,
                transitionId: outputArcs[i].transitionId,
                weight: outputArcs[i].weight
            }));
        }
    }

    /**
     * A function to update the state of the workflow instance.
     *  - Checks which transitions are enabled based on the current marking.
     */
    function updateInstanceState(uint64 workflowId) internal {
        Instance storage inst = workflowInstances[workflowId];

    }
    /**
     * On task completion, this function triggers a transition firing:
     * - Updates the marking based on the output arcs of the transition
     * - Updates the state of the workflow instance to enable new transitions.
     */
    function completeTask(uint64 workflowId, uint16 transitionId) external {
        updateInstanceState(workflowId);
    }

    /**
     * Getter functions to retrieve workflow (instance) details
     */
    function getPlaces(uint64 workflowId) external view returns (uint16[] memory workflowPlaces) {
        workflowPlaces = new uint16[](workflowInstances[workflowId].placeIds.length);
        for (uint i = 0; i < workflowInstances[workflowId].placeIds.length; i++) {
            workflowPlaces[i] = workflowInstances[workflowId].placeIds[i];
        }
        return workflowPlaces;
    }
    function getWorkflowTransitions(uint64 workflowId) external view returns (Transition[] memory transitions) {
        transitions = new Transition[](workflowInstances[workflowId].transitionIds.length);
        for (uint i=0; i< workflowInstances[workflowId].transitionIds.length; i++) {
            uint16 tId = workflowInstances[workflowId].transitionIds[i];
            transitions[i] = workflowInstances[workflowId].transitions[tId];
        }
        return transitions;
    }
    function getWorkflowTransitionById(uint64 workflowId, uint16 transitionId) external view returns (Transition memory transition) {
        return workflowInstances[workflowId].transitions[transitionId];
    }
    function getWorkflowInputArcs(uint64 workflowId) external view returns (InputArc[] memory inputArcs) {
        uint16 arcLength = 0;
        for (uint16 i = 0; i < workflowInstances[workflowId].placeIds.length; i++) {
            uint16 placeId = workflowInstances[workflowId].placeIds[i];
            arcLength = uint16(arcLength + workflowInstances[workflowId].inputArcs[placeId].length);
        }
        inputArcs = new InputArc[](arcLength);
        uint16 currentIndex = 0;
        for (uint16 i = 0; i < workflowInstances[workflowId].placeIds.length; i++) {
            uint16 placeId = workflowInstances[workflowId].placeIds[i];
            InputArc[] storage arcs = workflowInstances[workflowId].inputArcs[placeId];
            for (uint j = 0; j < arcs.length; j++) {
                inputArcs[currentIndex] = arcs[j];
                currentIndex++;
            }
        }
        return inputArcs;
    }
    function getWorkflowOutputArcs(uint64 workflowId) external view returns (OutputArc[] memory outputArcs) {
        uint16 arcLength = 0;
        for (uint16 i = 0; i < workflowInstances[workflowId].transitionIds.length; i++) {
            uint16 transitionId = workflowInstances[workflowId].transitionIds[i];
            arcLength = uint16(arcLength + workflowInstances[workflowId].outputArcs[transitionId].length);
        }
        outputArcs = new OutputArc[](arcLength);
        uint16 currentIndex = 0;
        for (uint16 i = 0; i < workflowInstances[workflowId].transitionIds.length; i++) {
            uint16 transitionId = workflowInstances[workflowId].transitionIds[i];
            OutputArc[] storage arcs = workflowInstances[workflowId].outputArcs[transitionId];
            for (uint j = 0; j < arcs.length; j++) {
                outputArcs[currentIndex] = arcs[j];
                currentIndex++;
            }
        }
        return outputArcs;
    }
    function getMarking(uint64 workflowId) external view returns (uint16[] memory places, uint16[] memory marking) {
        places = workflowInstances[workflowId].placeIds;
        marking = new uint16[](workflowInstances[workflowId].placeIds.length);
        for (uint16 i = 0; i < workflowInstances[workflowId].placeIds.length; i++) {
            uint16 placeId = workflowInstances[workflowId].placeIds[i];
            marking[i] = workflowInstances[workflowId].marking[placeId];
        }
    }


}

