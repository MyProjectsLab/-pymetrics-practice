# Lengths V1 packet and L1 main integration

The original packet, exact-byte freeze, L1 headless implementation, and held-key repair were cherry-picked in order from the separately reviewed commits `549cbed`, `0da999e`, `4928e91`, and `df01d43`. The resulting `src/lengths` Git tree is exactly `4d2264f5519a906fc52e4e5ee527369a53c33dca` in both the independently audited repair source and this integration. Frozen packet bytes are unchanged.

The integration adds `lengths:check` to the routine repository check. In the isolated integration checkout, all 27 Lengths tests, exact form/fixture regeneration, and the production TypeScript/build passed. These checks do not establish a playable game or qualify a browser/device. Persistence, live display/input, candidate journey, mock, and complete-game audit remain open.
