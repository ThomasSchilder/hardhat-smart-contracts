const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");


const AssetType = {
    DATASET: 0,
    MODEL: 1,
    FUNCTION: 2,
    VM: 3,
    CLUSTER: 4
};

describe("Create agreement", () => {

    // Fixture for deploying Agreement contract
    async function deployAgreementFixture() {
        const [owner, addr1, addr2] = await ethers.getSigners();

        // deploy the WorkflowEngine contract
        const agreementContract = await ethers.deployContract("Agreement");
        await agreementContract.waitForDeployment();

        return { agreementContract, owner, addr1, addr2 };
    }

    it("Should successfully deploy the Agreement contract", async () => {
        const { agreementContract, owner, addr1, addr2 } = await loadFixture(deployAgreementFixture);

        // Contract should be deployed
        expect(agreementContract).to.not.equal(null);
        expect(agreementContract).to.not.equal(undefined);

        let address = await agreementContract.getAddress();

        expect(address).to.not.equal(null);
        expect(address).to.not.equal(undefined);
    });

    it("Should successfully upload an asset", async () => {
        const { agreementContract, owner, addr1, addr2 } = await loadFixture(deployAgreementFixture);

        // Upload an asset
        let tx = await agreementContract.connect(owner).createAsset(AssetType['DATASET']);

        await expect(tx).to.emit(agreementContract, "AssetCreated").withArgs(1, AssetType['DATASET'], owner) ;

    });

    it ("Should successfully add users if owner", async () => {
        const { agreementContract, owner, addr1, addr2 } = await loadFixture(deployAgreementFixture);

        let txCreateAsset = await agreementContract.connect(owner).createAsset(AssetType['FUNCTION']);

        await expect(txCreateAsset).to.emit(agreementContract, "AssetCreated").withArgs(1, AssetType['FUNCTION'], owner) ;

        // Owner can set user access
        let txSetUserAccess = await agreementContract.connect(owner).setUserAccess(1, [addr1], [true])

        await expect(txSetUserAccess).to.emit(agreementContract, "UserAccessChanged").withArgs(1, addr1, true);

        // Other users can't set access
        let nonOwnerSetUserAccess = await expect(agreementContract.connect(addr2).setUserAccess(1, [addr2], [true]))
        .to.be.revertedWithCustomError(agreementContract, "Unauthorized") .withArgs(1, addr2);
    });

    it ("Should succesfully query user access rights for all users", async () => {
        const { agreementContract, owner, addr1, addr2 } = await loadFixture(deployAgreementFixture);

        let txCreateAsset = await agreementContract.connect(owner).createAsset(AssetType['MODEL']);

        await expect(txCreateAsset).to.emit(agreementContract, "AssetCreated").withArgs(1, AssetType['MODEL'], owner) ;

        let txSetUserAccess = await agreementContract.connect(owner).setUserAccess(1, [addr1, addr2], [true, false])

        // Everyone should be able to query access rights
        let user1HasAccess = await agreementContract.connect(addr2).userIsAllowed(1, addr1);
        console.log('resultuser1', {user1HasAccess});

        expect(user1HasAccess).to.equal(true);

        let user2HasAccess = await agreementContract.connect(addr1).userIsAllowed(1, addr2);
        expect(user2HasAccess).to.equal(false);
    })
})