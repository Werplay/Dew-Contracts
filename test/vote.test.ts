import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { WeRplay, WrpVote } from "../typechain-types";
import { getDefaultProvider, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";

describe("Vote", function () {
	let token: WeRplay;
	let vote: WrpVote;
	let deployer: SignerWithAddress,
		otherAccount: SignerWithAddress,
		fundsReciever: SignerWithAddress,
		buyer: SignerWithAddress,
		royaltyGetter: SignerWithAddress,
		redCaptain: SignerWithAddress,
		greenCaptain: SignerWithAddress,
		yellowCaptain: SignerWithAddress,
		blueCaptain: SignerWithAddress,
		testNewAdmin: SignerWithAddress;

	before("Deployment and variables setup", async () => {
		[
			deployer,
			otherAccount,
			fundsReciever,
			buyer,
			royaltyGetter,
			redCaptain,
			greenCaptain,
			yellowCaptain,
			blueCaptain,
			testNewAdmin,
		] = await ethers.getSigners();

		const Token = await ethers.getContractFactory("WeRplay");
		const Vote = await ethers.getContractFactory("wrpVote");

		token = (await upgrades.deployProxy(Token, {
			initializer: "initialize",
			kind: "uups",
		})) as WeRplay;

		await token.deployed();

		vote = (await upgrades.deployProxy(
			Vote,
			[deployer.address, token.address],
			{
				initializer: "initialize",
				kind: "uups",
			}
		)) as WrpVote;

		await vote.deployed();
	});

	describe("Parameters Test", function () {
		it("token granting Token Admin to vote contract", async function () {
			await token.grantRole(await token.TOKEN_ADMIN(), vote.address);
			expect(
				await token.hasRole(await token.TOKEN_ADMIN(), vote.address)
			).to.be.equal(true);
		});

		it("Vote contract admin has intialiazed roles", async function () {
			let hasRoles = await Promise.all([
				vote.hasRole(await vote.DEFAULT_ADMIN_ROLE(), deployer.address),
				vote.hasRole(await vote.TECH_ADMIN(), deployer.address),
				vote.hasRole(await vote.TOKEN_ADMIN(), deployer.address),
			]);

			hasRoles.map((e) => expect(e).to.be.equal(true));
		});

		it("Reverts: Cohort Id not valid", async function () {
			let cohortId = 4;

			// Create a new cohort with id < 0;
			await expect(
				vote.setupCohort(cohortId, "Green", greenCaptain.address)
			).to.be.revertedWith("Cohort Id not valid");
		});

		it("Test setup cohort all cohorts", async function () {
			// Creates a normal cohort

			let cohortId = 0;
			// 0
			await vote.setupCohort(cohortId++, "Red", redCaptain.address);
			// 1
			await vote.setupCohort(cohortId++, "Blue", blueCaptain.address);
			// 2
			await vote.setupCohort(cohortId++, "Green", greenCaptain.address);
			// 3
			await vote.setupCohort(cohortId, "Yellow", yellowCaptain.address);

			let totalCohorts = await vote.totalCohorts();
			expect(totalCohorts).to.equal(cohortId + 1);
		});

		it("Reverts: Five cohorts already setup", async function () {
			let cohortId = 10;

			// Create a new cohort with id < 0;
			await expect(
				vote.setupCohort(cohortId, "Green", greenCaptain.address)
			).to.be.revertedWith("Five cohorts already setup");
		});

		it("Reverts: Duplicate id 0 ", async function () {
			let cohortId = 0;
			await expect(
				vote.setupCohort(cohortId, "Redd", redCaptain.address)
			).to.be.revertedWith("Cohort Already set");
		});

		it("Reverts: Setup Cohort called by unauthorized role.", async function () {
			await expect(
				vote.connect(otherAccount).setupCohort(1, "Green", greenCaptain.address)
			).to.be.revertedWith(
				`AccessControl: account ${otherAccount.address.toLowerCase()} is missing role ${await vote.TECH_ADMIN()}`
			);
		});

		it("Cohort name and id is set correctly", async function () {
			let cohortId = 0;
			let cohortName = "Red";
			let admin = redCaptain.address;

			let cohort = await vote.cohortMap(cohortId);

			expect(cohort.name).to.be.equal(cohortName);
			expect(cohort.admin).to.be.equal(admin);
		});

		// 	it("saleActive is false", async function () {
		// 		expect(await jambroSale.saleActive()).to.be.equal(false);
		// 	});

		// 	it("royaltyGetter is right", async function () {
		// 		expect(await jambroSale.royaltyGetter()).to.be.equal(
		// 			royaltyGetter.address
		// 		);
		// 	});

		// 	it("royalty is right", async function () {
		// 		expect(await jambroSale.royalty()).to.be.equal(royalty);
		// 	});
	});

	describe("Proposals", async function () {
		it("Test only cohort admin can create proposal", async function () {
			await vote
				.connect(redCaptain)
				.makeProposal(0, "Test Objective for red cohort", 30);

			expect(await (await vote.proposalMap(0)).exists).to.be.equal(true);
		});
		it("Reverts: Captain of another cohort can not create propsals in another cohort", async function () {
			let timeFrame = 3 * 60 * 60;
			await expect(
				vote
					.connect(greenCaptain)
					.makeProposal(1, "Test Objective for red cohort", timeFrame)
			).revertedWith("Not Cohort Admin");
		});

		it("Proposal owner voted with in timeframe", async function () {
			await vote.connect(redCaptain).vote(0, 0);
			let hasVoted = await vote.proposalVotingMap(0, 0);
			expect(hasVoted).to.be.equal(true);
		});

		it("Anyother cohort captain vote with in timeframe", async function () {
			await vote.connect(greenCaptain).vote(0, 2);

			let hasVoted = await vote.proposalVotingMap(0, 2);
			expect(hasVoted).to.be.equal(true);
		});

		it("Reverts: Voting result not available will still voting", async function () {
			await expect(vote.resultOfProposal(0)).revertedWith(
				"Voting Still Active"
			);
		});
		it("Forwarding block chain time", async function () {
			let blockChainTime = await time.latest();
			let newBlockChainTime = await time.increase(4 * 3600);
			expect(newBlockChainTime).to.be.equal(blockChainTime + 4 * 3600);
		});

		it("Returns votes after voting ended", async function () {
			let proposalResults = await vote.resultOfProposal(0);
			expect(proposalResults).to.be.equal(2);
		});

		it("Reverts: Voting Not Active", async function () {
			await expect(vote.connect(yellowCaptain).vote(0, 3)).revertedWith(
				"Voting Not Active"
			);
		});
	});

	describe("Change Default Admin", async function () {
		it("Reverts: Not Cohort Admin", async function () {
			await expect(
				vote.connect(otherAccount).changeDefaultAdmin(testNewAdmin.address, 0)
			).revertedWith("Not Cohort Admin");
		});
		it("Vote casted by a cohort admin", async function () {
			let totalCohorts = await vote.totalCohorts();
			let totalVotes = 0;
			for (let i = 0; i < totalCohorts.toBigInt(); i++) {
				if (await vote.changeDefaultAdminMap(testNewAdmin.address, i))
					totalVotes++;
			}

			await vote
				.connect(redCaptain)
				.changeDefaultAdmin(testNewAdmin.address, 0);

			let newTotalVotes = 0;
			for (let i = 0; i < totalCohorts.toBigInt(); i++) {
				if (await vote.changeDefaultAdminMap(testNewAdmin.address, i))
					newTotalVotes++;
			}

			expect(totalVotes).to.be.equal(0);
			expect(newTotalVotes).to.be.equal(1);
		});

		it("Default admin changes at half or more cohorts vote", async function () {
			expect(
				await vote.hasRole(
					await vote.DEFAULT_ADMIN_ROLE(),
					testNewAdmin.address
				)
			).to.be.equal(false);

			await vote
				.connect(greenCaptain)
				.changeDefaultAdmin(testNewAdmin.address, 2);
			await vote
				.connect(yellowCaptain)
				.changeDefaultAdmin(testNewAdmin.address, 3);

			expect(
				await vote.hasRole(
					await vote.DEFAULT_ADMIN_ROLE(),
					testNewAdmin.address
				)
			).to.be.equal(true);
		});

		it("Clear Default Admin Map After Voting is done", async function () {
			let isEmpty = false;
			let totalCohorts = await vote.totalCohorts();

			for (let i = 0; i < totalCohorts.toNumber(); i++) {
				if (await vote.changeDefaultAdminMap(testNewAdmin.address, i)) {
					isEmpty = true;
					break;
				}
			}
			expect(isEmpty).to.be.equal(false);
		});
	});

	describe("Change Cohort Admin", async function () {
		it("Reverts: Not Cohort Admin", async function () {
			await expect(
				vote.connect(otherAccount).changeCohortAdmin(testNewAdmin.address, 0, 2)
			).revertedWith("Not Cohort Admin");
		});
		it("Reverts: Current Admin of Cohort cannot vote", async function () {
			await expect(
				vote.connect(redCaptain).changeCohortAdmin(testNewAdmin.address, 0, 0)
			).revertedWith("Current Admin of Cohort cannot vote");
		});

		it("Half or more votes changes the cohort admin.", async function () {
			expect((await vote.cohortMap(0)).admin).to.be.equal(redCaptain.address);

			await vote
				.connect(blueCaptain)
				.changeCohortAdmin(testNewAdmin.address, 1, 0);
			await vote
				.connect(greenCaptain)
				.changeCohortAdmin(testNewAdmin.address, 2, 0);
			await vote
				.connect(yellowCaptain)
				.changeCohortAdmin(testNewAdmin.address, 3, 0);

			expect((await vote.cohortMap(0)).admin).to.be.equal(testNewAdmin.address);
		});

		it("Clear Cohort Admin Map After Voting is done", async function () {
			let isEmpty = false;
			let totalCohorts = await vote.totalCohorts();

			for (let i = 0; i < totalCohorts.toNumber(); i++) {
				if (await vote.changeCohortAdminMap(0, testNewAdmin.address, i)) {
					isEmpty = true;
					break;
				}
			}
			expect(isEmpty).to.be.equal(false);
		});
	});
});
