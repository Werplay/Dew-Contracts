import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { Jambro } from "../typechain-types";
import { Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";

describe("Jambro", function () {
	let jambro: Jambro;
	let owner: SignerWithAddress, otherAccount: SignerWithAddress;

	before("Deployment and variables setup", async () => {
		[owner, otherAccount] = await ethers.getSigners();

		const Jambro = await ethers.getContractFactory("Jambro");

		jambro = (await upgrades.deployProxy(Jambro, [owner.address], {
			initializer: "initialize",
			kind: "uups",
		})) as Jambro;

		await jambro.deployed();
	});

	describe("Parameters Test", function () {
		it("Should set the right owner", async function () {
			expect(
				await jambro.hasRole(await jambro.DEFAULT_ADMIN_ROLE(), owner.address)
			).to.be.equal(true);
		});

		it("Symbol should be right", async function () {
			expect(await jambro.symbol()).to.be.equal("JAMB");
		});
	});

	describe("Mint Test", function () {
		it("Total Supply should be 0", async function () {
			expect(await jambro.totalSupply()).to.be.equal(0);
		});

		it("Reverts : Non Minter tries to mint", async function () {
			await expect(
				jambro.connect(otherAccount).safeMint(owner.address, "someURI")
			).to.be.revertedWith(
				`AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
			);
		});

		it("Minter Mints", async function () {
			await jambro.connect(owner).safeMint(owner.address, "someURI");
		});

		it("TotalSupply is 1", async function () {
			expect(await jambro.totalSupply()).to.be.equal(1);
		});
	});
});
