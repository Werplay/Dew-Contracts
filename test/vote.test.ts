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
		zero: SignerWithAddress,
		one: SignerWithAddress,
		two: SignerWithAddress,
		three: SignerWithAddress,
		four: SignerWithAddress;

	before("Deployment and variables setup", async () => {
		[deployer, zero, one, two, three, four] = await ethers.getSigners();

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
	});

	describe("setupCohort Test", function () {
		it("sets up 5 cohorts", async function () {
			const admins = [
				zero.address,
				one.address,
				two.address,
				three.address,
				four.address,
			];

			for (let i = 0; i < 5; i++) {
				await vote.setupCohort(i, `Cohort ${i}`, admins[i]);
				const res = await vote.cohortMap(i);
				expect(res.name).to.be.equal(`Cohort ${i}`);
				expect(res.admin).to.be.equal(admins[i]);
				expect(res.exists).to.be.equal(true);
				expect(await vote.totalCohorts()).to.be.equal(i + 1);
			}
		});

		// it("Forwards blockchain to active sale time", async function () {
		// 	await time.increase(ONE_DAY_IN_SECS);
		// });

		// it("Reverts : setting up NFT for sale with price 0", async function () {
		// 	await expect(
		// 		jambroSale.setForSale(1, ethers.utils.parseEther("0"))
		// 	).to.be.revertedWith("Price cannot be 0");
		// });

		// it("Reverts : setting up NFT for sale not minted yet", async function () {
		// 	await expect(
		// 		jambroSale.setForSale(1, ethers.utils.parseEther("1"))
		// 	).to.be.revertedWith("ERC721: invalid token ID");
		// });

		// it("Mints id 0 to deployer and 1 to otherAccount", async function () {
		// 	await jambro.safeMint(deployer.address, "uri For Id 0");
		// 	await jambro.safeMint(otherAccount.address, "uri For Id 1");

		// 	expect(await jambro.deployerOf(0)).to.be.equal(deployer.address);

		// 	expect(await jambro.deployerOf(1)).to.be.equal(otherAccount.address);
		// });

		// it("Reverts : setting up NFT for sale not owned by caller", async function () {
		// 	await expect(
		// 		jambroSale.setForSale(1, ethers.utils.parseEther("1"))
		// 	).to.be.revertedWith("Address not deployer of this token Id");
		// });

		// it("Reverts : setting up NFT for sale but no allowance to sale contract", async function () {
		// 	await expect(
		// 		jambroSale
		// 			.connect(otherAccount)
		// 			.setForSale(1, ethers.utils.parseEther("1"))
		// 	).to.be.revertedWith("Sale Contract not approved for this NFT");
		// });

		// it("sets up nft 1 for sale with price 2 eth", async function () {
		// 	await jambro.connect(otherAccount).approve(jambroSale.address, 1);
		// 	await jambroSale
		// 		.connect(otherAccount)
		// 		.setForSale(1, ethers.utils.parseEther("2"));

		// 	const price = ethers.utils.parseEther("2");
		// 	expect((await jambroSale.nftMap(1)).price).to.be.equal(price);
		// });

		// it("updates nft 1 for sale with price 2.5 eth", async function () {
		// 	await jambro.connect(otherAccount).approve(jambroSale.address, 1);
		// 	await jambroSale
		// 		.connect(otherAccount)
		// 		.setForSale(1, ethers.utils.parseEther("2.5"));

		// 	const price = ethers.utils.parseEther("2.5");
		// 	expect((await jambroSale.nftMap(1)).price).to.be.equal(price);
		// });

		// it("sale jambro Commission is right", async function () {
		// 	const result = await jambroSale
		// 		.connect(buyer)
		// 		.jambroCommission(ethers.utils.parseEther("2.5"));

		// 	expect(ethers.utils.formatEther(result)).to.be.equal("0.025");
		// });

		// it("setting commission to 10%", async function () {
		// 	await jambroSale
		// 		.connect(deployer)
		// 		.setRoyalty(ethers.utils.parseEther("0.1"));
		// });

		// it("sale jambro Commission is right", async function () {
		// 	const result = await jambroSale
		// 		.connect(buyer)
		// 		.jambroCommission(ethers.utils.parseEther("2.5"));

		// 	expect(ethers.utils.formatEther(result)).to.be.equal("0.25");
		// });
	});

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
