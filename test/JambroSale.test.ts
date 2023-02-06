import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { Jambro, JambroSale, JambroSaleV2 } from "../typechain-types";
import { getDefaultProvider, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";

describe("JambroSale", function () {
	let jambro: Jambro;
	let jambroSale: JambroSaleV2;
	let owner: SignerWithAddress,
		otherAccount: SignerWithAddress,
		fundsReciever: SignerWithAddress,
		buyer: SignerWithAddress,
		royaltyGetter: SignerWithAddress;

	const ONE_DAY_IN_SECS = 24 * 60 * 60;

	const royalty = ethers.utils.parseEther("0.01");

	before("Deployment and variables setup", async () => {
		[owner, otherAccount, fundsReciever, buyer, royaltyGetter] =
			await ethers.getSigners();

		const Jambro = await ethers.getContractFactory("Jambro");
		const JambroSale = await ethers.getContractFactory("JambroSale");
		const JambroSaleV2 = await ethers.getContractFactory("JambroSaleV2");

		jambro = (await upgrades.deployProxy(Jambro, [owner.address], {
			initializer: "initialize",
			kind: "uups",
		})) as Jambro;

		await jambro.deployed();

		const jambroSaleV1 = (await upgrades.deployProxy(
			JambroSale,
			[
				owner.address,
				royaltyGetter.address,
				royalty,
				(await time.latest()) + ONE_DAY_IN_SECS,
				jambro.address,
			],
			{
				initializer: "initialize",
				kind: "uups",
			}
		)) as JambroSale;

		await jambroSaleV1.deployed();

		jambroSale = (await upgrades.upgradeProxy(
			jambroSaleV1.address,
			JambroSaleV2
		)) as JambroSaleV2;

		await jambroSale.deployed();
	});

	describe("Parameters Test", function () {
		it("Version was upgraded", async function () {
			expect(await jambroSale.Version()).to.be.equal(2);
		});

		it("Owner is correct", async function () {
			expect(
				await jambroSale.hasRole(
					await jambro.DEFAULT_ADMIN_ROLE(),
					owner.address
				)
			).to.be.equal(true);
		});

		it("saleActive is false", async function () {
			expect(await jambroSale.saleActive()).to.be.equal(false);
		});

		it("royaltyGetter is right", async function () {
			expect(await jambroSale.royaltyGetter()).to.be.equal(
				royaltyGetter.address
			);
		});

		it("royalty is right", async function () {
			expect(await jambroSale.royalty()).to.be.equal(royalty);
		});
	});

	describe("Sale Setup Test", function () {
		it("Reverts : setting up NFT for sale when Sale is not Active", async function () {
			await expect(
				jambroSale.setForSale(1, ethers.utils.parseEther("1"))
			).to.be.revertedWith("Sale is not Active");
		});

		it("Forwards blockchain to active sale time", async function () {
			await time.increase(ONE_DAY_IN_SECS);
		});

		it("Reverts : setting up NFT for sale with price 0", async function () {
			await expect(
				jambroSale.setForSale(1, ethers.utils.parseEther("0"))
			).to.be.revertedWith("Price cannot be 0");
		});

		it("Reverts : setting up NFT for sale not minted yet", async function () {
			await expect(
				jambroSale.setForSale(1, ethers.utils.parseEther("1"))
			).to.be.revertedWith("ERC721: invalid token ID");
		});

		it("Mints id 0 to owner and 1 to otherAccount", async function () {
			await jambro.safeMint(owner.address, "uri For Id 0");
			await jambro.safeMint(otherAccount.address, "uri For Id 1");

			expect(await jambro.ownerOf(0)).to.be.equal(owner.address);

			expect(await jambro.ownerOf(1)).to.be.equal(otherAccount.address);
		});

		it("Reverts : setting up NFT for sale not owned by caller", async function () {
			await expect(
				jambroSale.setForSale(1, ethers.utils.parseEther("1"))
			).to.be.revertedWith("Address not owner of this token Id");
		});

		it("Reverts : setting up NFT for sale but no allowance to sale contract", async function () {
			await expect(
				jambroSale
					.connect(otherAccount)
					.setForSale(1, ethers.utils.parseEther("1"))
			).to.be.revertedWith("Sale Contract not approved for this NFT");
		});

		it("sets up nft 1 for sale with price 2 eth", async function () {
			await jambro.connect(otherAccount).approve(jambroSale.address, 1);
			await jambroSale
				.connect(otherAccount)
				.setForSale(1, ethers.utils.parseEther("2"));

			const price = ethers.utils.parseEther("2");
			expect((await jambroSale.nftMap(1)).price).to.be.equal(price);
		});

		it("updates nft 1 for sale with price 2.5 eth", async function () {
			await jambro.connect(otherAccount).approve(jambroSale.address, 1);
			await jambroSale
				.connect(otherAccount)
				.setForSale(1, ethers.utils.parseEther("2.5"));

			const price = ethers.utils.parseEther("2.5");
			expect((await jambroSale.nftMap(1)).price).to.be.equal(price);
		});

		it("sale jambro Commission is right", async function () {
			const result = await jambroSale
				.connect(buyer)
				.jambroCommission(ethers.utils.parseEther("2.5"));

			expect(ethers.utils.formatEther(result)).to.be.equal("0.025");
		});

		it("setting commission to 10%", async function () {
			await jambroSale
				.connect(owner)
				.setRoyalty(ethers.utils.parseEther("0.1"));
		});

		it("sale jambro Commission is right", async function () {
			const result = await jambroSale
				.connect(buyer)
				.jambroCommission(ethers.utils.parseEther("2.5"));

			expect(ethers.utils.formatEther(result)).to.be.equal("0.25");
		});
	});

	describe("Buy Test", function () {
		it("Reverts : buys a nft not for sale", async function () {
			await expect(jambroSale.connect(buyer).buy(0)).to.be.rejectedWith(
				"NFT not for Sale"
			);
		});

		it("Reverts : buys a nft with value not equal to price", async function () {
			await expect(
				jambroSale
					.connect(buyer)
					.buy(1, { value: ethers.utils.parseEther("2") })
			).to.be.rejectedWith("Value not equal to sale price");
		});

		it("Sets nft not for sale", async function () {
			await jambroSale.connect(otherAccount).removeFromSale(1);
		});

		it("Reverts : buys a nft", async function () {
			await expect(
				jambroSale
					.connect(buyer)
					.buy(1, { value: ethers.utils.parseEther("2.5") })
			).to.be.rejectedWith("NFT not for Sale");
		});

		it("sets up nft 1 for sale with price 2.5 eth", async function () {
			await jambro.connect(otherAccount).approve(jambroSale.address, 1);
			await jambroSale
				.connect(otherAccount)
				.setForSale(1, ethers.utils.parseEther("2.5"));

			const price = ethers.utils.parseEther("2.5");
			expect((await jambroSale.nftMap(1)).price).to.be.equal(price);
		});

		it("buys a nft", async function () {
			await jambroSale
				.connect(buyer)
				.buy(1, { value: ethers.utils.parseEther("2.5") });
		});

		it("NFT 1 is no longer for sale", async function () {
			expect((await jambroSale.connect(buyer).nftMap(1)).forSale).to.be.equal(
				false
			);

			expect((await jambroSale.connect(buyer).nftMap(1)).price).to.be.equal(0);

			expect((await jambroSale.connect(buyer).nftMap(1)).owner).to.be.equal(
				ethers.constants.AddressZero
			);
		});

		it("previous owner gets sale funds from buyer", async function () {
			const balance = ethers.utils.formatEther(await otherAccount.getBalance());
			expect(parseFloat(balance).toFixed(2)).to.be.equal("10002.25");
		});

		it("royalty getter gets royalty funds", async function () {
			const balance = ethers.utils.formatEther(
				await royaltyGetter.getBalance()
			);
			expect(parseFloat(balance).toFixed(2)).to.be.equal("10000.25");
		});
	});
});
