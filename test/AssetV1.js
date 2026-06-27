const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

const AssetType = {
    DATASET: 0,
    MODEL: 1,
    FUNCTION: 2,
    VM: 3,
    CLUSTER: 4
};

const AssetStatus = {
    AVAILABLE: 0,
    ARCHIVED: 1
};

const Protocol = {
    HTTP: 0,
    FTP: 1,
    S3: 2
};

describe("AssetV1", () => {

    async function deployAssetV1Fixture() {
        const [owner, addr1, addr2] = await ethers.getSigners();

        const assetContract = await ethers.deployContract("AssetV1");
        await assetContract.waitForDeployment();

        return { assetContract, owner, addr1, addr2 };
    }

    it("Should successfully deploy the AssetV1 contract", async () => {
        const { assetContract } = await loadFixture(deployAssetV1Fixture);

        expect(assetContract).to.not.equal(null);
        expect(assetContract).to.not.equal(undefined);

        let address = await assetContract.getAddress();
        expect(address).to.not.equal(null);
        expect(address).to.not.equal(undefined);
    });

    it("Should successfully create an asset", async () => {
        const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

        let tx = await assetContract.connect(owner).createAsset(
            "My Dataset",
            "https://example.com/data",
            Protocol['HTTP'],
            AssetType['DATASET'],
            '{"description":"A test dataset"}'
        );

        await expect(tx).to.emit(assetContract, "AssetCreated")
            .withArgs(1, AssetType['DATASET'], owner, "My Dataset", "https://example.com/data", Protocol['HTTP'], '{"description":"A test dataset"}');
    });

    it("Should return correct asset data after creation", async () => {
        const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

        await assetContract.connect(owner).createAsset(
            "My Model",
            "s3://bucket/model",
            Protocol['S3'],
            AssetType['MODEL'],
            '{"format":"onnx"}'
        );

        expect(await assetContract.getName(1)).to.equal("My Model");
        expect(await assetContract.getUrl(1)).to.equal("s3://bucket/model");
        expect(await assetContract.getProtocol(1)).to.equal(Protocol['S3']);
        expect(await assetContract.getAssetType(1)).to.equal(AssetType['MODEL']);
        expect(await assetContract.getOwner(1)).to.equal(owner.address);
        expect(await assetContract.getStatus(1)).to.equal(AssetStatus['AVAILABLE']);
        expect(await assetContract.getMetadata(1)).to.equal('{"format":"onnx"}');
    });

    it("Should update all fields at once via updateAsset", async () => {
        const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

        await assetContract.connect(owner).createAsset(
            "Original",
            "https://old.com",
            Protocol['HTTP'],
            AssetType['DATASET'],
            '{"v":1}'
        );

        let tx = await assetContract.connect(owner).updateAsset(1, "Updated", "ftp://new.com", Protocol['FTP'], '{"v":2}');
        await expect(tx).to.emit(assetContract, "AssetUpdated").withArgs(1);

        expect(await assetContract.getName(1)).to.equal("Updated");
        expect(await assetContract.getUrl(1)).to.equal("ftp://new.com");
        expect(await assetContract.getProtocol(1)).to.equal(Protocol['FTP']);
        expect(await assetContract.getMetadata(1)).to.equal('{"v":2}');
    });

    it("Should update individual fields via setters", async () => {
        const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

        await assetContract.connect(owner).createAsset(
            "Original",
            "https://old.com",
            Protocol['HTTP'],
            AssetType['FUNCTION'],
            '{}'
        );

        let txName = await assetContract.connect(owner).setName(1, "New Name");
        await expect(txName).to.emit(assetContract, "AssetUpdated").withArgs(1);
        expect(await assetContract.getName(1)).to.equal("New Name");

        let txUrl = await assetContract.connect(owner).setUrl(1, "s3://bucket/file");
        await expect(txUrl).to.emit(assetContract, "AssetUpdated").withArgs(1);
        expect(await assetContract.getUrl(1)).to.equal("s3://bucket/file");

        let txProtocol = await assetContract.connect(owner).setProtocol(1, Protocol['S3']);
        await expect(txProtocol).to.emit(assetContract, "AssetUpdated").withArgs(1);
        expect(await assetContract.getProtocol(1)).to.equal(Protocol['S3']);

        let txMetadata = await assetContract.connect(owner).setMetadata(1, '{"updated":true}');
        await expect(txMetadata).to.emit(assetContract, "AssetUpdated").withArgs(1);
        expect(await assetContract.getMetadata(1)).to.equal('{"updated":true}');
    });

    it("Should change asset status via changeStatus", async () => {
        const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

        await assetContract.connect(owner).createAsset(
            "Test",
            "https://test.com",
            Protocol['HTTP'],
            AssetType['VM'],
            '{}'
        );

        let tx = await assetContract.connect(owner).changeStatus(1, AssetStatus['ARCHIVED']);
        await expect(tx).to.emit(assetContract, "AssetStatusChanged").withArgs(1, AssetStatus['ARCHIVED']);

        expect(await assetContract.getStatus(1)).to.equal(AssetStatus['ARCHIVED']);
    });

    it("Should archive an asset via archiveAsset", async () => {
        const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

        await assetContract.connect(owner).createAsset(
            "To Archive",
            "ftp://archive.com",
            Protocol['FTP'],
            AssetType['CLUSTER'],
            '{}'
        );

        let tx = await assetContract.connect(owner).archiveAsset(1);
        await expect(tx).to.emit(assetContract, "AssetArchived").withArgs(1);
        await expect(tx).to.emit(assetContract, "AssetStatusChanged").withArgs(1, AssetStatus['ARCHIVED']);

        expect(await assetContract.getStatus(1)).to.equal(AssetStatus['ARCHIVED']);
    });

    it("Should revert when non-owner tries to update", async () => {
        const { assetContract, owner, addr1 } = await loadFixture(deployAssetV1Fixture);

        await assetContract.connect(owner).createAsset(
            "Owned",
            "https://owned.com",
            Protocol['HTTP'],
            AssetType['DATASET'],
            '{}'
        );

        await expect(assetContract.connect(addr1).updateAsset(1, "Hacked", "bad", Protocol['FTP'], '{"hacked":true}'))
            .to.be.revertedWithCustomError(assetContract, "Unauthorized").withArgs(1, addr1.address);

        await expect(assetContract.connect(addr1).setName(1, "Hacked"))
            .to.be.revertedWithCustomError(assetContract, "Unauthorized").withArgs(1, addr1.address);

        await expect(assetContract.connect(addr1).setUrl(1, "bad"))
            .to.be.revertedWithCustomError(assetContract, "Unauthorized").withArgs(1, addr1.address);

        await expect(assetContract.connect(addr1).setProtocol(1, Protocol['S3']))
            .to.be.revertedWithCustomError(assetContract, "Unauthorized").withArgs(1, addr1.address);

        await expect(assetContract.connect(addr1).setMetadata(1, '{"hacked":true}'))
            .to.be.revertedWithCustomError(assetContract, "Unauthorized").withArgs(1, addr1.address);

        await expect(assetContract.connect(addr1).archiveAsset(1))
            .to.be.revertedWithCustomError(assetContract, "Unauthorized").withArgs(1, addr1.address);
    });

    it("Should revert when trying to update an archived asset", async () => {
        const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

        await assetContract.connect(owner).createAsset(
            "Archived",
            "https://archived.com",
            Protocol['HTTP'],
            AssetType['DATASET'],
            '{}'
        );

        await assetContract.connect(owner).archiveAsset(1);

        await expect(assetContract.connect(owner).updateAsset(1, "New", "new", Protocol['S3'], '{}'))
            .to.be.revertedWithCustomError(assetContract, "AssetArchivedError").withArgs(1);

        await expect(assetContract.connect(owner).setName(1, "New"))
            .to.be.revertedWithCustomError(assetContract, "AssetArchivedError").withArgs(1);

        await expect(assetContract.connect(owner).setUrl(1, "new"))
            .to.be.revertedWithCustomError(assetContract, "AssetArchivedError").withArgs(1);

        await expect(assetContract.connect(owner).setProtocol(1, Protocol['S3']))
            .to.be.revertedWithCustomError(assetContract, "AssetArchivedError").withArgs(1);

        await expect(assetContract.connect(owner).setMetadata(1, '{"new":true}'))
            .to.be.revertedWithCustomError(assetContract, "AssetArchivedError").withArgs(1);

        await expect(assetContract.connect(owner).archiveAsset(1))
            .to.be.revertedWithCustomError(assetContract, "AssetArchivedError").withArgs(1);

        await expect(assetContract.connect(owner).changeStatus(1, AssetStatus['AVAILABLE']))
            .to.be.revertedWithCustomError(assetContract, "AssetArchivedError").withArgs(1);
    });

    it("Should revert when accessing non-existent asset", async () => {
        const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

        await expect(assetContract.connect(owner).updateAsset(999, "X", "X", Protocol['HTTP'], '{}'))
            .to.be.revertedWithCustomError(assetContract, "AssetNotFound").withArgs(999);

        await expect(assetContract.connect(owner).setMetadata(999, '{}'))
            .to.be.revertedWithCustomError(assetContract, "AssetNotFound").withArgs(999);

        await expect(assetContract.connect(owner).archiveAsset(999))
            .to.be.revertedWithCustomError(assetContract, "AssetNotFound").withArgs(999);
    });

    it("Should support multiple assets with incremental IDs", async () => {
        const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

        await assetContract.connect(owner).createAsset("First", "https://a.com", Protocol['HTTP'], AssetType['DATASET'], '{"order":1}');
        await assetContract.connect(owner).createAsset("Second", "ftp://b.com", Protocol['FTP'], AssetType['MODEL'], '{"order":2}');
        await assetContract.connect(owner).createAsset("Third", "s3://c.com", Protocol['S3'], AssetType['FUNCTION'], '{"order":3}');

        expect(await assetContract.getName(1)).to.equal("First");
        expect(await assetContract.getName(2)).to.equal("Second");
        expect(await assetContract.getName(3)).to.equal("Third");

        expect(await assetContract.getProtocol(1)).to.equal(Protocol['HTTP']);
        expect(await assetContract.getProtocol(2)).to.equal(Protocol['FTP']);
        expect(await assetContract.getProtocol(3)).to.equal(Protocol['S3']);

        expect(await assetContract.getMetadata(1)).to.equal('{"order":1}');
        expect(await assetContract.getMetadata(2)).to.equal('{"order":2}');
        expect(await assetContract.getMetadata(3)).to.equal('{"order":3}');

        expect(await assetContract.incrementalAssetId()).to.equal(3);
    });

    describe("policyAddress", () => {

        it("Should return address(0) by default after creation", async () => {
            const { assetContract, owner } = await loadFixture(deployAssetV1Fixture);

            await assetContract.connect(owner).createAsset(
                "Test Asset",
                "https://test.com",
                Protocol['HTTP'],
                AssetType['DATASET'],
                '{}'
            );

            expect(await assetContract.getPolicyAddress(1)).to.equal(ethers.ZeroAddress);
        });

        it("Should set policyAddress and emit AssetPolicySet", async () => {
            const { assetContract, owner, addr1 } = await loadFixture(deployAssetV1Fixture);

            await assetContract.connect(owner).createAsset(
                "Test Asset",
                "https://test.com",
                Protocol['HTTP'],
                AssetType['DATASET'],
                '{}'
            );

            let tx = await assetContract.connect(owner).setPolicyAddress(1, addr1.address);
            await expect(tx).to.emit(assetContract, "AssetPolicySet")
                .withArgs(1, addr1.address);

            expect(await assetContract.getPolicyAddress(1)).to.equal(addr1.address);
        });

        it("Should allow updating policyAddress", async () => {
            const { assetContract, owner, addr1, addr2 } = await loadFixture(deployAssetV1Fixture);

            await assetContract.connect(owner).createAsset(
                "Test Asset",
                "https://test.com",
                Protocol['HTTP'],
                AssetType['DATASET'],
                '{}'
            );

            await assetContract.connect(owner).setPolicyAddress(1, addr1.address);
            expect(await assetContract.getPolicyAddress(1)).to.equal(addr1.address);

            await assetContract.connect(owner).setPolicyAddress(1, addr2.address);
            expect(await assetContract.getPolicyAddress(1)).to.equal(addr2.address);
        });

        it("Should allow setting policyAddress back to address(0)", async () => {
            const { assetContract, owner, addr1 } = await loadFixture(deployAssetV1Fixture);

            await assetContract.connect(owner).createAsset(
                "Test Asset",
                "https://test.com",
                Protocol['HTTP'],
                AssetType['DATASET'],
                '{}'
            );

            await assetContract.connect(owner).setPolicyAddress(1, addr1.address);
            await assetContract.connect(owner).setPolicyAddress(1, ethers.ZeroAddress);

            expect(await assetContract.getPolicyAddress(1)).to.equal(ethers.ZeroAddress);
        });

        it("Should revert when non-owner tries to set policyAddress", async () => {
            const { assetContract, owner, addr1 } = await loadFixture(deployAssetV1Fixture);

            await assetContract.connect(owner).createAsset(
                "Test Asset",
                "https://test.com",
                Protocol['HTTP'],
                AssetType['DATASET'],
                '{}'
            );

            await expect(assetContract.connect(addr1).setPolicyAddress(1, addr1.address))
                .to.be.revertedWithCustomError(assetContract, "Unauthorized").withArgs(1, addr1.address);
        });

        it("Should revert when setting policyAddress on archived asset", async () => {
            const { assetContract, owner, addr1 } = await loadFixture(deployAssetV1Fixture);

            await assetContract.connect(owner).createAsset(
                "Test Asset",
                "https://test.com",
                Protocol['HTTP'],
                AssetType['DATASET'],
                '{}'
            );

            await assetContract.connect(owner).archiveAsset(1);

            await expect(assetContract.connect(owner).setPolicyAddress(1, addr1.address))
                .to.be.revertedWithCustomError(assetContract, "AssetArchivedError").withArgs(1);
        });

        it("Should revert when setting policyAddress on non-existent asset", async () => {
            const { assetContract, owner, addr1 } = await loadFixture(deployAssetV1Fixture);

            await expect(assetContract.connect(owner).setPolicyAddress(999, addr1.address))
                .to.be.revertedWithCustomError(assetContract, "AssetNotFound").withArgs(999);
        });
    });
});
