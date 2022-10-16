const { ethers } = require("hardhat");

async function mintAndList() {
  const Price = ethers.utils.parseEther("0.1");
  const NftMarketplace = await ethers.getContract("NftMarketplace");
  const BasicNft = await ethers.getContract("BasicNft");
  console.log("Minting .....");
  const mintTx = await BasicNft.mintNft();
  const mintTxReceipt = await mintTx.wait(1);
  const tokenId = mintTxReceipt.events[0].args.tokenId;
  console.log("Approving Nft....");
  const approvalTx = await BasicNft.approve(NftMarketplace.address, tokenId);
  await approvalTx.wait(1);

  console.log("Listing Nft...");
  const listTx = await NftMarketplace.listItem(
    BasicNft.address,
    tokenId,
    Price
  );
  await listTx.wait(1);
  console.log("Listed!");
}

mintAndList()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
