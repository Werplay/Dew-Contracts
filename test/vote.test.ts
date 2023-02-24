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
		blueCaptain: SignerWithAddress
		;

	before("Deployment and variables setup", async () => {
		[deployer, otherAccount, fundsReciever, buyer, royaltyGetter, redCaptain, greenCaptain, yellowCaptain, blueCaptain] =
			await ethers.getSigners();

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
			])

			hasRoles.map((e) => expect(e).to.be.equal(true));
		});

		it("Test setup cohort all cohorts", async function () {
			// Creates a normal cohort

			let cohortId = 0;
			await vote.setupCohort(cohortId++, "Red", redCaptain.address);
			await vote.setupCohort(cohortId++, "Blue", blueCaptain.address);
			await vote.setupCohort(cohortId++, "Green", greenCaptain.address);
			await vote.setupCohort(cohortId, "Yellow", yellowCaptain.address);

			let totalCohorts = await vote.totalCohorts();
			expect(totalCohorts).to.equal(cohortId + 1);

		})

		it("Reverts: Cohort id more than counter", async function () {
			let cohortId = 10;

			// Create a new cohort with id < 0;
			await expect(vote.setupCohort(cohortId, "Green", greenCaptain.address))
				.to
				.be
				.revertedWith("Cohort Id not valid");
		})

		it("Reverts: Duplicate id 0 ", async function () {
			let cohortId = 0;
			await expect(vote.setupCohort(cohortId, "Redd", redCaptain.address)).to.be.revertedWith("Cohort Already set");
		})

		it("Reverts: Setup Cohort called by unauthorized role.", async function () {
			await expect(
				vote.connect(otherAccount).setupCohort(1, "Green", greenCaptain.address)
			).to.be.revertedWith(
				`AccessControl: account ${otherAccount.address.toLowerCase()} is missing role ${await vote.TECH_ADMIN()}`
			);
		})

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
			await vote.connect(redCaptain)
				.makeProposal(0, "Test Objective for red cohort", 30);

			expect(await (await vote.proposalMap(0)).exists)
				.to
				.be
				.equal(true);
		})
		it("Reverts: Captain of another cohort can not create propsals in another cohort", async function () {
			let timeFrame = 3 * 60 * 60;
			await expect(vote.connect(greenCaptain)
				.makeProposal(1, "Test Objective for red cohort", timeFrame)).revertedWith('Not Cohort Admin');
		})

		it("Proposal owner voted with in timeframe", async function () {
			await vote.connect(redCaptain).vote(0, 0);
			let hasVoted = await vote.proposalVotingMap(0, 0);
			expect(hasVoted).to.be.equal(true);
		})

		it("Anyother cohort captain vote with in timeframe", async function () {
			await vote.connect(greenCaptain).vote(0, 2);

			let hasVoted = await vote.proposalVotingMap(0, 2);
			expect(hasVoted).to.be.equal(true);
		})

		it("Reverts: Voting result not available will still voting", async function () {
			await expect(vote.resultOfProposal(0)).revertedWith("Voting Still Active");
		})
		it("Forwarding block chain time", async function () {
			let blockChainTime = await time.latest();
			let newBlockChainTime = await time.increase(4 * 3600);
			expect(newBlockChainTime).to.be.equal(blockChainTime + (4 * 3600));
		})

		it("Returns votes after voting ended", async function () {
			let proposalResults = await vote.resultOfProposal(0);
			expect(proposalResults).to.be.equal(2);
		})

		it("Reverts: Voting Not Active", async function () {
			await expect(vote.connect(yellowCaptain).vote(0, 3))
				.revertedWith("Voting Not Active");
		});
	})

	// describe("Sale Setup Test", function () {
	// 	it("Reverts : setting up NFT for sale when Sale is not Active", async function () {
	// 		await expect(
	// 			jambroSale.setForSale(1, ethers.utils.parseEther("1"))
	// 		).to.be.revertedWith("Sale is not Active");
	// 	});

	// 	it("Forwards blockchain to active sale time", async function () {
	// 		await time.increase(ONE_DAY_IN_SECS);
	// 	});

	// 	it("Reverts : setting up NFT for sale with price 0", async function () {
	// 		await expect(
	// 			jambroSale.setForSale(1, ethers.utils.parseEther("0"))
	// 		).to.be.revertedWith("Price cannot be 0");
	// 	});

	// 	it("Reverts : setting up NFT for sale not minted yet", async function () {
	// 		await expect(
	// 			jambroSale.setForSale(1, ethers.utils.parseEther("1"))
	// 		).to.be.revertedWith("ERC721: invalid token ID");
	// 	});

	// 	it("Mints id 0 to deployer and 1 to otherAccount", async function () {
	// 		await jambro.safeMint(deployer.address, "uri For Id 0");
	// 		await jambro.safeMint(otherAccount.address, "uri For Id 1");

	// 		expect(await jambro.deployerOf(0)).to.be.equal(deployer.address);

	// 		expect(await jambro.deployerOf(1)).to.be.equal(otherAccount.address);
	// 	});

	// 	it("Reverts : setting up NFT for sale not owned by caller", async function () {
	// 		await expect(
	// 			jambroSale.setForSale(1, ethers.utils.parseEther("1"))
	// 		).to.be.revertedWith("Address not deployer of this token Id");
	// 	});

	// 	it("Reverts : setting up NFT for sale but no allowance to sale contract", async function () {
	// 		await expect(
	// 			jambroSale
	// 				.connect(otherAccount)
	// 				.setForSale(1, ethers.utils.parseEther("1"))
	// 		).to.be.revertedWith("Sale Contract not approved for this NFT");
	// 	});

	// 	it("sets up nft 1 for sale with price 2 eth", async function () {
	// 		await jambro.connect(otherAccount).approve(jambroSale.address, 1);
	// 		await jambroSale
	// 			.connect(otherAccount)
	// 			.setForSale(1, ethers.utils.parseEther("2"));

	// 		const price = ethers.utils.parseEther("2");
	// 		expect((await jambroSale.nftMap(1)).price).to.be.equal(price);
	// 	});

	// 	it("updates nft 1 for sale with price 2.5 eth", async function () {
	// 		await jambro.connect(otherAccount).approve(jambroSale.address, 1);
	// 		await jambroSale
	// 			.connect(otherAccount)
	// 			.setForSale(1, ethers.utils.parseEther("2.5"));

	// 		const price = ethers.utils.parseEther("2.5");
	// 		expect((await jambroSale.nftMap(1)).price).to.be.equal(price);
	// 	});

	// 	it("sale jambro Commission is right", async function () {
	// 		const result = await jambroSale
	// 			.connect(buyer)
	// 			.jambroCommission(ethers.utils.parseEther("2.5"));

	// 		expect(ethers.utils.formatEther(result)).to.be.equal("0.025");
	// 	});

	// 	it("setting commission to 10%", async function () {
	// 		await jambroSale
	// 			.connect(deployer)
	// 			.setRoyalty(ethers.utils.parseEther("0.1"));
	// 	});

	// 	it("sale jambro Commission is right", async function () {
	// 		const result = await jambroSale
	// 			.connect(buyer)
	// 			.jambroCommission(ethers.utils.parseEther("2.5"));

	// 		expect(ethers.utils.formatEther(result)).to.be.equal("0.25");
	// 	});
	// });

	// describe("Buy Test", function () {
	// 	it("Reverts : buys a nft not for sale", async function () {
	// 		await expect(jambroSale.connect(buyer).buy(0)).to.be.rejectedWith(
	// 			"NFT not for Sale"
	// 		);
	// 	});

	// 	it("Reverts : buys a nft with value not equal to price", async function () {
	// 		await expect(
	// 			jambroSale
	// 				.connect(buyer)
	// 				.buy(1, { value: ethers.utils.parseEther("2") })
	// 		).to.be.rejectedWith("Value not equal to sale price");
	// 	});

	// 	it("Sets nft not for sale", async function () {
	// 		await jambroSale.connect(otherAccount).removeFromSale(1);
	// 	});

	// 	it("Reverts : buys a nft", async function () {
	// 		await expect(
	// 			jambroSale
	// 				.connect(buyer)
	// 				.buy(1, { value: ethers.utils.parseEther("2.5") })
	// 		).to.be.rejectedWith("NFT not for Sale");
	// 	});

	// 	it("sets up nft 1 for sale with price 2.5 eth", async function () {
	// 		await jambro.connect(otherAccount).approve(jambroSale.address, 1);
	// 		await jambroSale
	// 			.connect(otherAccount)
	// 			.setForSale(1, ethers.utils.parseEther("2.5"));

	// 		const price = ethers.utils.parseEther("2.5");
	// 		expect((await jambroSale.nftMap(1)).price).to.be.equal(price);
	// 	});

	// 	it("buys a nft", async function () {
	// 		await jambroSale
	// 			.connect(buyer)
	// 			.buy(1, { value: ethers.utils.parseEther("2.5") });
	// 	});

	// 	it("NFT 1 is no longer for sale", async function () {
	// 		expect((await jambroSale.connect(buyer).nftMap(1)).forSale).to.be.equal(
	// 			false
	// 		);

	// 		expect((await jambroSale.connect(buyer).nftMap(1)).price).to.be.equal(0);

	// 		expect((await jambroSale.connect(buyer).nftMap(1)).deployer).to.be.equal(
	// 			ethers.constants.AddressZero
	// 		);
	// 	});

	// 	it("previous deployer gets sale funds from buyer", async function () {
	// 		const balance = ethers.utils.formatEther(await otherAccount.getBalance());
	// 		expect(parseFloat(balance).toFixed(2)).to.be.equal("10002.25");
	// 	});

	// 	it("royalty getter gets royalty funds", async function () {
	// 		const balance = ethers.utils.formatEther(
	// 			await royaltyGetter.getBalance()
	// 		);
	// 		expect(parseFloat(balance).toFixed(2)).to.be.equal("10000.25");
	// 	});
	// });
});
