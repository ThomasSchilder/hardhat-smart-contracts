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

console.log("null value for address", Null.ADDRESS);

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
    function createValidPetrinet() {
        const places = [1, 2, 3];

        const transitions = [
            { transitionId: 1, state: 0, claimedBy: Null.ADDRESS, imageCID: CID.parse("QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5").bytes, metadataCID: ethers.getBytes("0x") },
            { transitionId: 2, state: 0, claimedBy: Null.ADDRESS, imageCID: CID.parse("QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5").bytes, metadataCID: ethers.getBytes("0x") },

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
        const { workflowEngine, owner, addr1, addr2 } = await loadFixture(deployWorkflowEngineFixture);

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
        expect(firstTransition.state).to.equal(0);
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
        let { marking } = await workflowEngine.getMarking(1);
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
        expect(tx).to.emit(workflowEngine, "WorkflowCreated").withArgs(1, owner.address);
        expect(tx).to.emit(workflowEngine, "TaskScheduled").withArgs(1, 1, "QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5", Null.ADDRESS)
    });

    it("Should determine fireable transitions correctly: workflow creation", async () => {
        const { workflowEngine, owner } = await loadFixture(deployWorkflowEngineFixture);

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

    it("Should be able to access worflow variables", async () => {

    })

    it("Should check fire guards correctly", async () => {

    })
})

// In the workflow builder: Work with macro's
// - Select from asset store
// --> each macro is a petrinet structure

// XOR
// JOIN
// SPLIT



// Idea create a transition type :
// - task
// - signoff
// - user input
// - timeout (race)


