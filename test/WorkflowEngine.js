const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

/**
 * Simulate Enum values using constants:
 **/
const ArcType = {
    INPUT: 0,
    OUTPUT: 1
};

const State = {
    CREATED: 0,
    SCHEDULED: 1,
    CLAIMED: 2,
    AWAIT_USER_INPUT: 3,
    RUNNING: 4,
    COMPLETED: 5,
    FAILED: 6,
    SKIPPED: 7
};

const VarType = {
    STRING: 0,
    NUMBER: 1,
    BOOLEAN: 2,
    ADDRESS: 3,
    CID: 4
}

// Constants
const Null = {
    BYTES: ethers.getBytes("0x"),
    ADDRESS: ethers.ZeroAddress
}

describe("WorkflowEngine contract", () => {

    let CID = null;
    before(async () => {
        CID = (await import("multiformats/cid")).CID;
        console.log("Succesfully loaded multiformats CID module:", CID);
    });

    /**
     * Function to create a valid petrinet definition for testing.
     * The petrinet will be in it simples form: start->task->end.
     */
    function createValidPetrinet(ownerAddress=Null.ADDRESS) {
        const places = [1, 2, 3];

        const transitions = [
            { transitionId: 1, state: 0, claimedBy: ownerAddress, imageCID: CID.parse("QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5").bytes, metadataCID: Null.BYTES },
            { transitionId: 2, state: 0, claimedBy: ownerAddress, imageCID: CID.parse("QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5").bytes, metadataCID: Null.BYTES },

        ];
        const arcs = [
            { transitionId: 1, placeId: 1, weight: 1, arcType: ArcType.INPUT },
            { transitionId: 2, placeId: 2, weight: 1, arcType: ArcType.INPUT},
            { transitionId: 1, placeId: 2, weight: 1, arcType: ArcType.OUTPUT},
            { transitionId: 2, placeId: 3, weight: 1, arcType: ArcType.OUTPUT}
        ]

        const initialMarking = [1, 0, 0];
        const finalPlaces = [3];
        return { places, transitions, arcs, initialMarking, finalPlaces };
    }

    function bytesToCID(bytes) {
        if (bytes == '0x') return null;
        bytes = ethers.getBytes(bytes);
        return CID.decode(bytes).toString();
    }

    async function deployWorkflowEngineFixture() {
        const [owner, addr1, addr2] = await ethers.getSigners();

        // deploy the WorkflowEngine contract
        const workflowEngine = await ethers.deployContract("WorkflowEngine");
        await workflowEngine.waitForDeployment();

        return { workflowEngine, owner, addr1, addr2 };
    }

    it("Should succesfully deploy the WorkflowEngine contract", async () => {
        const { workflowEngine } = await loadFixture(deployWorkflowEngineFixture);

        // Contract should be deployed.
        expect(workflowEngine).to.not.equal(null);
        expect(workflowEngine).to.not.equal(undefined);

        let address = await workflowEngine.getAddress();
        expect(address).to.not.equal(null);
        expect(address).to.not.equal(undefined);
    })

    it("Should succesfully create a new workflow instance", async () => {
        const { workflowEngine, owner } = await loadFixture(deployWorkflowEngineFixture);

        // Create simple petri-net
        const { places, transitions, arcs, initialMarking, finalPlaces } = createValidPetrinet();

        // Create a new workflow instance
        const tx = await workflowEngine.createWorkflow(places, transitions, arcs, initialMarking, finalPlaces)

        // Retrieve the created workflow instance (id = 1, automatically increments)
        let instance = await workflowEngine.workflowInstances(1);

        // Expect correct instance properties
        expect(instance.owner).to.equal(owner.address);

        // Check if places were created correctly
        let createdPlaces = await workflowEngine.getPlaces(1);
        expect(createdPlaces.length).to.equal(places.length);
        places.map(placeId => {
            // Transform ethers BigInt to Number for comparison (1n -> 1).
            expect(createdPlaces.map(Number)).to.include(placeId);
        })

        // Check if transitions were created correctly: check 2nd transition (should have state 0: CREATED; not yet enabled)
        let createdTransitions = await workflowEngine.getWorkflowTransitions(1);
        let firstTransition = createdTransitions[1];
        expect(firstTransition.transitionId).to.equal(2);
        expect(firstTransition.state).to.equal(State.CREATED);
        expect(bytesToCID(firstTransition.imageCID)).to.equal("QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5");
        expect(bytesToCID(firstTransition.metadataCID)).to.be.null;

        // Check if arcs were created correctly
        let createdArcs = await workflowEngine.getWorkflowArcs(1);
        expect(createdArcs.length).to.equal(arcs.length);
        expect(createdArcs[0].placeId).to.equal(arcs[0].placeId);
        expect(createdArcs[0].transitionId).to.equal(arcs[0].transitionId);
        expect(createdArcs[0].weight).to.equal(arcs[0].weight);
        expect(createdArcs[0].arcType).to.equal(ArcType.INPUT)


        // Check if initial marking was created correctly
        let marking  = await workflowEngine.getMarking(1);
        expect(marking.length).to.equal(initialMarking.length);
        expect(marking[0]).to.equal(initialMarking[0]);
        expect(marking[1]).to.equal(initialMarking[1]);
        expect(marking[2]).to.equal(initialMarking[2]);


        // Check if finalPlaces are set
        let expectedNotFinal = await workflowEngine.isFinalPlace(1, 1);
        let expectedFinal = await workflowEngine.isFinalPlace(1, 3);
        expect(expectedNotFinal).to.equal(false);
        expect(expectedFinal).to.equal(true);

        // Check if events were emitted
        await expect(tx).to.emit(workflowEngine, "WorkflowCreated").withArgs(1, owner.address);
        await expect(tx).to.emit(workflowEngine, "TaskSetScheduled").withArgs(1, 1, CID.parse("QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5").bytes, Null.BYTES)
    });

    it("Should determine fireable transitions correctly: workflow creation", async () => {
        const { workflowEngine } = await loadFixture(deployWorkflowEngineFixture);

        // Create simple petri-net
        const { places, transitions, arcs, initialMarking, finalPlaces } = createValidPetrinet();

        // Create a new workflow instance
        const tx = await workflowEngine.createWorkflow(places, transitions, arcs, initialMarking, finalPlaces)

        /**
         * After creation, the updateInstanceState function is executed, which updates the state of transitions based on the marking
         **/
        let createdTransitions = await workflowEngine.getWorkflowTransitions(1);
        // First transition should be enabled
        let firstTransition = createdTransitions[0];
        expect(firstTransition.transitionId).to.equal(1);
        // Expect to equal to SCHEDULED (2)
        expect(firstTransition.state).to.equal(State.SCHEDULED);

        // Second transition should still be disabled
        let secondTransition = createdTransitions[1];
        expect(secondTransition.transitionId).to.equal(2);
        expect(secondTransition.state).to.equal(State.CREATED);

    });

    it("Should be able to claim tasks", async () => {
         const { workflowEngine, owner, addr1, addr2} = await loadFixture(deployWorkflowEngineFixture);

        // Create simple petri-net
        const { places, transitions, arcs, initialMarking, finalPlaces } = createValidPetrinet(owner);

        // Create a new workflow instance
        const tx = await workflowEngine.createWorkflow(places, transitions, arcs, initialMarking, finalPlaces)

        // Wait until the events have been emitted
        await expect(tx).to.emit(workflowEngine, "WorkflowCreated");
        await expect(tx).to.emit(workflowEngine, "TaskSetScheduled");

        // Store original marking: store first place
        let originalMarking = await workflowEngine.getMarking(1);
        expect(originalMarking[0]).to.equal(1);

        // Try to claim with wrong user
        await expect(workflowEngine.connect(addr1).claimTask(1, 1)).to.be.revertedWithCustomError(workflowEngine, "TaskReserved").withArgs(1, 1, owner)

        // Expect event: workflowId, transitionId & address
        await expect(workflowEngine.connect(owner).claimTask(1, 1)).to.emit(workflowEngine, "TaskSetClaimed").withArgs(1, 1, owner);

        // Expect tokens from input place to be consumed (test if place 1 is consumed);
        let updatedMarking = await workflowEngine.getMarking(1);
        expect(updatedMarking[0]).to.equal(0);

        // Not able to claim tasks when state is not scheduled (was already claimed by someone)
        await expect(workflowEngine.connect(addr2).claimTask(1, 1)).to.be.revertedWithCustomError(workflowEngine, "TaskWasAlreadyClaimed").withArgs(1, 1, owner);

        // Expect error when task cannot be claimed yet (test with next task)
        await expect(workflowEngine.connect(owner).claimTask(1, 2)).to.be.revertedWithCustomError(workflowEngine, "TaskUnclaimable").withArgs(1, 2);
    });

    it("Should be able to complete tasks and comlete workflow", async () => {
        const { workflowEngine, owner, addr1, addr2} = await loadFixture(deployWorkflowEngineFixture);

        // Create simple petri-net
        const { places, transitions, arcs, initialMarking, finalPlaces } = createValidPetrinet(owner);

        // Create a new workflow instance
        const tx = await workflowEngine.createWorkflow(places, transitions, arcs, initialMarking, finalPlaces)

        // Wait until the events have been emitted
        await expect(tx).to.emit(workflowEngine, "WorkflowCreated");
        await expect(tx).to.emit(workflowEngine, "TaskSetScheduled");

        // Claim task
        await expect(workflowEngine.connect(owner).claimTask(1, 1)).to.emit(workflowEngine, "TaskSetClaimed").withArgs(1, 1, owner);

        // Try to complete with the wrong user
        await expect(workflowEngine.connect(addr1).completeTask(1, 1)).to.be.revertedWithCustomError(workflowEngine, "CompletionNotAllowed").withArgs(1, 1)

        // Expect task 2 to still be scheduled
        let nextTransition = await workflowEngine.getWorkflowTransitionById(1, 2);
        expect(nextTransition.state).to.not.equal(State.SCHEDULED);

        // Complete task with correct user
        let completeTask = await workflowEngine.connect(owner).completeTask(1, 1);
        let taskCompleted = await workflowEngine.getWorkflowTransitionById(1, 1);
        expect(taskCompleted.state).to.equal(State.COMPLETED)
        await expect(completeTask).to.emit(workflowEngine, "TaskSetCompleted").withArgs(1, 1, owner);

        // Expect next task to be planned
        await expect(completeTask).to.emit(workflowEngine, "TaskSetScheduled").withArgs(1, 2, CID.parse("QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5").bytes, Null.BYTES)

        // Expect next task be scheduled.
        nextTransition = await workflowEngine.getWorkflowTransitionById(1, 2);
        expect(nextTransition.state).to.equal(State.SCHEDULED)

        // Claim and complete next task
        await expect(workflowEngine.connect(owner).claimTask(1, 2)).to.emit(workflowEngine, "TaskSetClaimed").withArgs(1, 2, owner);
        let completeLastTask = await workflowEngine.connect(owner).completeTask(1, 2);
        await expect(completeLastTask).to.emit(workflowEngine, "TaskSetCompleted").withArgs(1, 2, owner);

        // Expect all tasks to be completed
        let allTasks = await workflowEngine.getWorkflowTransitions(1);
        for (let task of allTasks) {
            expect(task.state).to.equal(State.COMPLETED);
        }

        // Expect workflowCompleted event
        await expect(completeLastTask).to.emit(workflowEngine, "WorkflowCompleted").withArgs(1);
    })


    it("Should not be able to claim skipped tasks", async () => {
        // For later: when XOR structures are implemented.
    })

    it("Should be able to access worflow variables", async () => {

    })

    it("Should check fire guards correctly", async () => {

    })
})

// In the workflow builder: Work with macro's
// - Select from asset store
// --> each macro is a petrinet structure

// XOR: EITHER OF TWO PATHS
// SPLIT: TWO PARALLEL PATHS
// JOIN: JOIN TWO PARALLEL PATHS




// Idea create a transition type :

// - task
// - automatic: for JOIN construct (merging all paths and continue)
// - signoff: wait until user X allows the workflow to continue (Active learning case?)
// - user input: reach quorum
// - timeout (task can be completed after X time)
//


