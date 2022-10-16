const { assert, expect } = require("chai");
const exp = require("constants");

const { network, deployments, ethers, getNamedAccounts } = require("hardhat");

const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("NftMarketplace", async function () {
      let NftMarketplace;
      let deployer, player, BasicNft;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        const accounts = await ethers.getSigners();
        player = accounts[1];
        await deployments.fixture(["all"]);
        NftMarketplace = await ethers.getContract("NftMarketplace", deployer);
        BasicNft = await ethers.getContract("BasicNft", deployer);
        const mintTx = await BasicNft.mintNft();

        await BasicNft.approve(NftMarketplace.address, 0);
        await NftMarketplace.listItem(BasicNft.address, 0, 1);
        await BasicNft.mintNft();
        await BasicNft.mintNft();
      });
      describe("listItem", async function () {
        it("fails if the token is not approved and throws an error", async function () {
          await expect(
            NftMarketplace.listItem(BasicNft.address, 1, 1)
          ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace");
        });
        it("fails if the price is lower or equal than zero and throws an error", async function () {
          await expect(
            NftMarketplace.listItem(BasicNft.address, 1, 0)
          ).to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero");
        });
        it("Lists an item and  emits an event", async function () {
          await BasicNft.approve(NftMarketplace.address, 1);
          await expect(NftMarketplace.listItem(BasicNft.address, 1, 1)).to.emit(
            NftMarketplace,
            "NftMarketplace__ItemListed"
          );
        });
        it("doesnt allow to be listed from others than the owner!", async function () {
          const playerConnectedNftMarketplace = await NftMarketplace.connect(
            player
          );
          await expect(
            playerConnectedNftMarketplace.listItem(BasicNft.address, 1, 1)
          ).to.revertedWith("NftMarketplace__NotOwner");
        });
        it("doesnt allow to be relisted", async function () {
          await BasicNft.approve(NftMarketplace.address, 1);
          await NftMarketplace.listItem(BasicNft.address, 1, 1);
          await expect(
            NftMarketplace.listItem(BasicNft.address, 1, 1)
          ).to.revertedWith("NftMarketplace__AlreadyListed");
        });
      });
      describe("buyItem", async function () {
        it("reverts if price is not met", async function () {
          const playerConnectedNftMarketplace = await NftMarketplace.connect(
            player
          );
          await expect(
            playerConnectedNftMarketplace.buyItem(BasicNft.address, 0, {
              value: 0,
            })
          ).to.be.revertedWith("NftMarketplace__PriceNotMet");
        });
        it("emits an event once an Nft is bought , updates sellers proceeds , delists the item and the new owner is the buyer!", async function () {
          const playerConnectedNftMarketplace = await NftMarketplace.connect(
            player
          );
          await expect(
            playerConnectedNftMarketplace.buyItem(BasicNft.address, 0, {
              value: 1,
            })
          ).to.emit(NftMarketplace, "ItemBought");

          const proceeds = await playerConnectedNftMarketplace.getProceeds(
            deployer
          );

          assert.equal(proceeds.toString(), "1");

          await expect(
            playerConnectedNftMarketplace.buyItem(BasicNft.address, 0, {
              value: 1,
            })
          ).to.be.revertedWith("NftMarketplace__NotListed");

          const newOwner = await BasicNft.ownerOf(0);
          assert.equal(newOwner, player.address);
        });
      });
      describe("cancelListing", async function () {
        it("throws an error if its not the owner who cancels!", async function () {
          const playerConnectedNftMarketplace = await NftMarketplace.connect(
            player
          );
          await expect(
            playerConnectedNftMarketplace.cancelListing(BasicNft.address, 0)
          ).to.be.revertedWith("NftMarketplace__NotOwner");
        });
        it("Throws an error if the item is not listed", async function () {
          await BasicNft.mintNft();
          let tokenCounter = await BasicNft.getTokenCounter();

          tokenCounter = tokenCounter - 1;

          await expect(
            NftMarketplace.cancelListing(
              BasicNft.address,
              tokenCounter.toString()
            )
          ).to.be.revertedWith("NftMarketplace__NotListed");
        });
        it("emits an event when it cancels a Listing and delists it", async function () {
          await expect(
            NftMarketplace.cancelListing(BasicNft.address, 0)
          ).to.emit(NftMarketplace, "NftMarketplace__ItemCancelled");
        });

        //const Listing = BasicNft.getListing();
      });
      describe("updateListing", async function () {
        it("throws an error if its not the owner who updates!", async function () {
          const playerConnectedNftMarketplace = await NftMarketplace.connect(
            player
          );
          await expect(
            playerConnectedNftMarketplace.updateListing(BasicNft.address, 0, 2)
          ).to.be.revertedWith("NftMarketplace__NotOwner");
        });
        it("Throws an error if the item is not listed", async function () {
          await BasicNft.mintNft();
          let tokenCounter = await BasicNft.getTokenCounter();

          tokenCounter = tokenCounter - 1;

          await expect(
            NftMarketplace.updateListing(
              BasicNft.address,
              tokenCounter.toString(),
              2
            )
          ).to.be.revertedWith("NftMarketplace__NotListed");
        });
        it("emits an event when it updates a Listing and changes its price", async function () {
          await expect(
            NftMarketplace.updateListing(BasicNft.address, 0, 2)
          ).to.emit(NftMarketplace, "NftMarketplace__ItemListed");
          let newPrice = await NftMarketplace.getListing(BasicNft.address, 0);
          newPrice = await newPrice.price;

          assert.equal(newPrice.toString(), 2);
        });
      });
      describe("withdrawProceeds", async function () {
        it("throws an error if the user has no proceeds in his account!", async function () {
          const zeroMoney = await NftMarketplace.getProceeds(deployer);
          await expect(NftMarketplace.withdrawProceeds()).to.be.revertedWith(
            "NftMarketplace__NoProceeds"
          );
        });
        it("emits an event when a user withdraws his proceeds and empties his balance", async function () {
          const playerConnectedNftMarketplace = await NftMarketplace.connect(
            player
          );
          await playerConnectedNftMarketplace.buyItem(BasicNft.address, 0, {
            value: 1,
          });

          const Money = await NftMarketplace.getProceeds(deployer);
          assert.equal(Money, 1);
          await NftMarketplace.withdrawProceeds();
          const zeroMoney = await NftMarketplace.getProceeds(deployer);
          assert.equal(zeroMoney, 0);
        });
      });
    });
