const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

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
        const places = [1, 2];

        const transitions = [
            { transitionId: 1, state: 0, imageCID: CID.parse("QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5").bytes, metadataCID: ethers.getBytes("0x") },
        ];
        const inputArcs = [
            { placeId: 1, transitionId: 1, weight: 1 }
        ];
        const outputArcs = [
            { transitionId: 1, placeId: 2, weight: 1 }
        ];
        const initialMarking = [1, 0];
        return { places, transitions, inputArcs, outputArcs, initialMarking }
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
        const { places, transitions, inputArcs, outputArcs, initialMarking } = createValidPetrinet();

        // Create a new workflow instance
        const tx = await workflowEngine.createWorkflow(places, transitions, inputArcs, outputArcs, initialMarking)

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

        // expect(instance.places(1)).to.equal(true);

        // Check if transitions were created correctly
        let createdTransitions = await workflowEngine.getWorkflowTransitions(1);
        let firstTransition = createdTransitions[0];
        expect(firstTransition.transitionId).to.equal(1);
        expect(firstTransition.state).to.equal(0);
        expect(bytesToCID(firstTransition.imageCID)).to.equal("QmfBMfSnC6wkxGiPXWckTBbAs5MvoJvsSBqe5zvotTSbz5");
        expect(bytesToCID(firstTransition.metadataCID)).to.be.null;

        // Check if input arcs were created correctly
        let createdInputArcs = await workflowEngine.getWorkflowInputArcs(1);
        expect(createdInputArcs.length).to.equal(inputArcs.length);
        expect(createdInputArcs[0].placeId).to.equal(inputArcs[0].placeId);
        expect(createdInputArcs[0].transitionId).to.equal(inputArcs[0].transitionId);
        expect(createdInputArcs[0].weight).to.equal(inputArcs[0].weight);

        // Check if output arcs were created correctly
        let createdOutputArcs = await workflowEngine.getWorkflowOutputArcs(1);
        expect(createdOutputArcs.length).to.equal(outputArcs.length);
        expect(createdOutputArcs[0].transitionId).to.equal(outputArcs[0].transitionId);
        expect(createdOutputArcs[0].placeId).to.equal(outputArcs[0].placeId);
        expect(createdOutputArcs[0].weight).to.equal(outputArcs[0].weight);

        // Check if initial marking was created correctly
        let { marking } = await workflowEngine.getMarking(1);
        expect(marking.length).to.equal(initialMarking.length);
        expect(marking[0]).to.equal(initialMarking[0]);
        expect(marking[1]).to.equal(initialMarking[1]);

        // Check if event was emitted.
        expect(tx).to.emit(workflowEngine, "WorkflowCreated").withArgs(1, owner.address);
    });
})