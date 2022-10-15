//SPDX-License-Identifier:MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(
  address nftAddress,
  uint256 tokenId,
  uint256 price
);
error NftMarketplace__NoProceeds();
error NftMarketplace__TransferedFailed();

contract NftMarketplace is ReentrancyGuard {
  struct Listing {
    uint256 price;
    address seller;
  }
  //////////////////////////////////////////////////////////////
  ///////////EVENTS//////////////////////////
  //////////////////////////////////////////////////////////////
  event NftMarketplace__ItemListed(
    address indexed seller,
    address indexed nftAddress,
    uint256 indexed tokenId,
    uint256 price
  );

  event ItemBought(
    address indexed buyer,
    address indexed nftAddress,
    uint256 indexed tokenId,
    uint256 price
  );
  event NftMarketplace__ItemCancelled(
    address indexed seller,
    address indexed nftAddress,
    uint256 tokenId
  );
  ///////////////////////////////
  //////////////MODIFIERS////////
  ///////////////////////////////
  modifier notListed(
    address nftAddress,
    uint256 tokenId,
    address owner
  ) {
    Listing memory listing = s_listings[nftAddress][tokenId];
    if (listing.price > 0) {
      revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
    }
    _;
  }

  modifier isOwner(
    address nftAddress,
    uint256 tokenId,
    address spender
  ) {
    IERC721 nft = IERC721(nftAddress);
    address owner = nft.ownerOf(tokenId);
    if (spender != owner) {
      revert NftMarketplace__NotOwner();
    }
    _;
  }

  modifier isListed(address nftAddress, uint256 tokenId) {
    Listing memory listing = s_listings[nftAddress][tokenId];
    if (listing.price <= 0) {
      revert NftMarketplace__NotListed(nftAddress, tokenId);
    }
    _;
  }

  //listing mapping NFT Contractaddress -> Listing
  mapping(address => mapping(uint256 => Listing)) private s_listings;

  //mapping sellers with their earnings
  mapping(address => uint256) private s_proceeds;

  function listItem(
    address nftAddress,
    uint256 tokenId,
    uint256 price
  )
    external
    notListed(nftAddress, tokenId, msg.sender)
    isOwner(nftAddress, tokenId, msg.sender)
  {
    if (price <= 0) {
      revert NftMarketplace__PriceMustBeAboveZero();
    }
    IERC721 nft = IERC721(nftAddress);
    if (nft.getApproved(tokenId) != address(this)) {
      revert NftMarketplace__NotApprovedForMarketplace();
    }
    emit NftMarketplace__ItemListed(msg.sender, nftAddress, tokenId, price);
  }

  //comment
  function buyItem(address nftAddress, uint256 tokenId)
    external
    payable
    nonReentrant
    isListed(nftAddress, tokenId)
  {
    //Listing memory listedItem = s_listings[nftAddress][tokenId];
    if (msg.value < s_listings[nftAddress][tokenId].price) {
      revert NftMarketplace__PriceNotMet(
        nftAddress,
        tokenId,
        s_listings[nftAddress][tokenId].price
      );
    }
    s_proceeds[s_listings[nftAddress][tokenId].seller] =
      s_proceeds[s_listings[nftAddress][tokenId].seller] +
      msg.value;
    delete (s_listings[nftAddress][tokenId]);
    IERC721(nftAddress).safeTransferFrom(
      s_listings[nftAddress][tokenId].seller,
      msg.sender,
      tokenId
    );
    emit ItemBought(
      msg.sender,
      nftAddress,
      tokenId,
      s_listings[nftAddress][tokenId].price
    );
  }

  function cancelListing(address nftAddress, uint256 tokenId)
    external
    isOwner(nftAddress, tokenId, msg.sender)
    isListed(nftAddress, tokenId)
  {
    delete (s_listings[nftAddress][tokenId]);
    emit NftMarketplace__ItemCancelled(msg.sender, nftAddress, tokenId);
  }

  function updateListing(
    address nftAddress,
    uint256 tokenId,
    uint256 newPrice
  )
    external
    isOwner(nftAddress, tokenId, msg.sender)
    isListed(nftAddress, tokenId)
  {
    s_listings[nftAddress][tokenId].price = newPrice;
    emit NftMarketplace__ItemListed(msg.sender, nftAddress, tokenId, newPrice);
  }

  function withdrawProceeds() external nonReentrant {
    uint256 proceeds = s_proceeds[msg.sender];
    if (proceeds <= 0) {
      revert NftMarketplace__NoProceeds();
    }
    s_proceeds[msg.sender] = 0;
    (bool success, ) = payable(msg.sender).call{ value: proceeds }("");
    if (!success) {
      revert NftMarketplace__TransferedFailed();
    }
  }

  function getListing(address nftAddress, uint256 tokenId)
    external
    view
    returns (Listing memory)
  {
    return s_listings[nftAddress][tokenId];
  }

  function getProceeds(address seller) external view returns (uint256) {
    return s_proceeds[seller];
  }
}
