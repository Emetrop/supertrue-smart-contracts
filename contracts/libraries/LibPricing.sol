// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@prb/math/contracts/PRBMathUD60x18.sol";

library LibPricing {
    using PRBMathUD60x18 for uint256;

    struct Layout {
        uint8 pricingType;
        uint256 startPrice; // in USD cents
        uint256 endPrice; // in USD cents
        uint256 reachEndPriceTokenId;
    }

    bytes32 private constant STORAGE_SLOT =
        keccak256("supertrue.storage.nft.pricing");

    function layout() private pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    // number of pricing types
    uint8 public constant TYPE_NUM = 1;

    // Types
    uint8 public constant TYPE_LOGARITHMIC = 0;
    // uint8 internal constant TYPE_SLOT_LINEAR = 1;
    // ...

    function setPricing(
        uint8 pricingType,
        uint256 startPrice,
        uint256 endPrice,
        uint256 reachEndPriceTokenId
    ) public {
        require(pricingType < TYPE_NUM, "Invalid pricing type");

        layout().pricingType = pricingType;
        layout().startPrice = startPrice;
        layout().endPrice = endPrice;
        layout().reachEndPriceTokenId = reachEndPriceTokenId;
    }

    /**
     * @dev Get 18 decimal price in native token for tokenId
     */
    function price(uint256 tokenId, uint256 tokenPrice)
        public
        view
        returns (uint256)
    {
        require(tokenId > 0, "TokenID has to be bigger than 0");

        // if (layout().pricingType == TYPE_LOGARITHMIC) {
        return priceLogarithmic(tokenId, tokenPrice.fromUint());
        // }
    }

    // ********** Logarithmic **********

    // Defaults
    uint256 private constant _reachEndPriceTokenIdDefault = 1000;
    uint256 private constant _startPriceDefault = 1000; // $10 in cents
    uint256 private constant _endPriceDefault = 5000; // $50 in cents

    // Settings
    uint256 private constant _logEndX = 2 ether; // has to be multiplier of 2!
    uint256 private constant _logEndY = 1 ether; // == log2(logEndX)

    function priceLogarithmic(uint256 tokenId, uint256 tokenPrice)
        private
        view
        returns (uint256)
    {
        uint256 endPriceTokenId = layout().reachEndPriceTokenId == 0
            ? _reachEndPriceTokenIdDefault
            : layout().reachEndPriceTokenId;

        uint256 startPrice = layout().startPrice == 0
            ? _startPriceDefault
            : layout().startPrice;
        startPrice = startPrice.fromUint();

        uint256 endPrice = layout().endPrice == 0
            ? _endPriceDefault
            : layout().endPrice;
        endPrice = endPrice.fromUint();

        if (tokenId >= endPriceTokenId) {
            return endPrice.div(tokenPrice);
        }
        if (tokenId == 1) {
            return startPrice.div(tokenPrice);
        }

        uint256 dec1 = uint256(1).fromUint();

        uint256 multiplier = (_logEndX - dec1).div(endPriceTokenId.fromUint());

        // returns number between 1 and logEndX
        uint256 x = dec1 + tokenId.fromUint().mul(multiplier);
        uint256 y = x.log2();

        uint256 normalisedPriceCents = endPrice - startPrice;
        uint256 priceCents = normalisedPriceCents.div(_logEndY).mul(y) +
            startPrice;

        return priceCents.div(tokenPrice);
    }
}
