const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("AMContract", () => {

    async function deployAMContractFixture() {
        const [issuer, subject1, subject2, stranger] = await ethers.getSigners();

        const amContract = await ethers.deployContract("AMContract");
        await amContract.waitForDeployment();

        return { amContract, issuer, subject1, subject2, stranger };
    }

    it("Should successfully deploy the AMContract", async () => {
        const { amContract, issuer } = await loadFixture(deployAMContractFixture);

        expect(amContract).to.not.equal(null);
        expect(await amContract.issuer()).to.equal(issuer.address);
    });

    it("Should allow issuer to set an attribute", async () => {
        const { amContract, issuer, subject1 } = await loadFixture(deployAMContractFixture);

        let tx = await amContract.connect(issuer).setAttribute(subject1.address, "role", "researcher");
        await expect(tx).to.emit(amContract, "AttributeSet")
            .withArgs(subject1.address, "role", "researcher");
    });

    it("Should return the correct attribute value", async () => {
        const { amContract, issuer, subject1 } = await loadFixture(deployAMContractFixture);

        await amContract.connect(issuer).setAttribute(subject1.address, "role", "researcher");

        expect(await amContract.getAttribute(subject1.address, "role")).to.equal("researcher");
    });

    it("Should return empty string for unset attribute", async () => {
        const { amContract, subject1 } = await loadFixture(deployAMContractFixture);

        expect(await amContract.getAttribute(subject1.address, "role")).to.equal("");
    });

    it("Should allow multiple attributes per subject", async () => {
        const { amContract, issuer, subject1 } = await loadFixture(deployAMContractFixture);

        await amContract.connect(issuer).setAttribute(subject1.address, "role", "researcher");
        await amContract.connect(issuer).setAttribute(subject1.address, "organization", "university");

        expect(await amContract.getAttribute(subject1.address, "role")).to.equal("researcher");
        expect(await amContract.getAttribute(subject1.address, "organization")).to.equal("university");
    });

    it("Should allow updating an existing attribute value", async () => {
        const { amContract, issuer, subject1 } = await loadFixture(deployAMContractFixture);

        await amContract.connect(issuer).setAttribute(subject1.address, "role", "researcher");
        expect(await amContract.getAttribute(subject1.address, "role")).to.equal("researcher");

        await amContract.connect(issuer).setAttribute(subject1.address, "role", "admin");
        expect(await amContract.getAttribute(subject1.address, "role")).to.equal("admin");
    });

    it("Should not duplicate keys when updating an existing attribute", async () => {
        const { amContract, issuer, subject1 } = await loadFixture(deployAMContractFixture);

        await amContract.connect(issuer).setAttribute(subject1.address, "role", "researcher");
        await amContract.connect(issuer).setAttribute(subject1.address, "role", "admin");

        const keys = await amContract.getAttributeKeys(subject1.address);
        expect(keys.length).to.equal(1);
        expect(keys[0]).to.equal("role");
    });

    it("Should return all attribute keys for a subject", async () => {
        const { amContract, issuer, subject1 } = await loadFixture(deployAMContractFixture);

        await amContract.connect(issuer).setAttribute(subject1.address, "role", "researcher");
        await amContract.connect(issuer).setAttribute(subject1.address, "organization", "university");
        await amContract.connect(issuer).setAttribute(subject1.address, "country", "NL");

        const keys = await amContract.getAttributeKeys(subject1.address);
        expect(keys).to.deep.equal(["role", "organization", "country"]);
    });

    it("Should isolate attributes between subjects", async () => {
        const { amContract, issuer, subject1, subject2 } = await loadFixture(deployAMContractFixture);

        await amContract.connect(issuer).setAttribute(subject1.address, "role", "researcher");
        await amContract.connect(issuer).setAttribute(subject2.address, "role", "admin");

        expect(await amContract.getAttribute(subject1.address, "role")).to.equal("researcher");
        expect(await amContract.getAttribute(subject2.address, "role")).to.equal("admin");
    });

    it("Should revert when non-issuer tries to set attribute", async () => {
        const { amContract, subject1, stranger } = await loadFixture(deployAMContractFixture);

        await expect(amContract.connect(stranger).setAttribute(subject1.address, "role", "hacker"))
            .to.be.revertedWith("Only issuer can set attributes");
    });

    it("Should return empty array for attribute keys of unknown subject", async () => {
        const { amContract, subject1 } = await loadFixture(deployAMContractFixture);

        const keys = await amContract.getAttributeKeys(subject1.address);
        expect(keys.length).to.equal(0);
    });
});
