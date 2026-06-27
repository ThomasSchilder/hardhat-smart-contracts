const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("ResearcherPolicy", () => {

    async function deployPolicyFixture() {
        const [owner, subject1, subject2, stranger] = await ethers.getSigners();

        const amContract = await ethers.deployContract("AMContract");
        await amContract.waitForDeployment();

        const policy = await ethers.deployContract("ResearcherPolicy", [await amContract.getAddress()]);
        await policy.waitForDeployment();

        return { amContract, policy, owner, subject1, subject2, stranger };
    }

    it("Should deploy with correct owner and AMContract", async () => {
        const { amContract, policy, owner } = await loadFixture(deployPolicyFixture);

        expect(await policy.owner()).to.equal(owner.address);
        expect(await policy.amContract()).to.equal(await amContract.getAddress());
    });

    it("Should return true for subject with role=researcher", async () => {
        const { amContract, policy, owner, subject1 } = await loadFixture(deployPolicyFixture);

        await amContract.connect(owner).setAttribute(subject1.address, "role", "researcher");

        expect(await policy.evaluate(subject1.address)).to.equal(true);
    });

    it("Should return false for subject with role=admin", async () => {
        const { amContract, policy, owner, subject1 } = await loadFixture(deployPolicyFixture);

        await amContract.connect(owner).setAttribute(subject1.address, "role", "admin");

        expect(await policy.evaluate(subject1.address)).to.equal(false);
    });

    it("Should return false for subject with no attributes", async () => {
        const { policy, subject1 } = await loadFixture(deployPolicyFixture);

        expect(await policy.evaluate(subject1.address)).to.equal(false);
    });

    it("Should return false for subject with empty role", async () => {
        const { amContract, policy, owner, subject1 } = await loadFixture(deployPolicyFixture);

        await amContract.connect(owner).setAttribute(subject1.address, "role", "");

        expect(await policy.evaluate(subject1.address)).to.equal(false);
    });

    it("Should be case-sensitive: Researcher != researcher", async () => {
        const { amContract, policy, owner, subject1 } = await loadFixture(deployPolicyFixture);

        await amContract.connect(owner).setAttribute(subject1.address, "role", "Researcher");

        expect(await policy.evaluate(subject1.address)).to.equal(false);
    });

    it("Should only check role attribute, ignore others", async () => {
        const { amContract, policy, owner, subject1 } = await loadFixture(deployPolicyFixture);

        await amContract.connect(owner).setAttribute(subject1.address, "organization", "university");
        await amContract.connect(owner).setAttribute(subject1.address, "country", "NL");

        expect(await policy.evaluate(subject1.address)).to.equal(false);

        await amContract.connect(owner).setAttribute(subject1.address, "role", "researcher");
        expect(await policy.evaluate(subject1.address)).to.equal(true);
    });

    it("Should work with multiple subjects", async () => {
        const { amContract, policy, owner, subject1, subject2 } = await loadFixture(deployPolicyFixture);

        await amContract.connect(owner).setAttribute(subject1.address, "role", "researcher");
        await amContract.connect(owner).setAttribute(subject2.address, "role", "admin");

        expect(await policy.evaluate(subject1.address)).to.equal(true);
        expect(await policy.evaluate(subject2.address)).to.equal(false);
    });

    it("Should evaluate as a view function (no state changes)", async () => {
        const { amContract, policy, owner, subject1 } = await loadFixture(deployPolicyFixture);

        await amContract.connect(owner).setAttribute(subject1.address, "role", "researcher");

        const result = await policy.evaluate.staticCall(subject1.address);
        expect(result).to.equal(true);
    });
});
