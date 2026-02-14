const test = require("node:test");
const assert = require("node:assert/strict");
const { NotFoundException } = require("@nestjs/common");
const { CatalogService } = require("../dist/modules/catalog/catalog.service");

function createService() {
  return new CatalogService();
}

async function onboardSampleVendors(service) {
  const v1 = await service.onboardVendor({
    ownerUserId: "owner_1",
    name: "Roma Fire Pizza",
    description: "Wood-fired Italian pizza",
    cuisineTags: ["italian", "pizza"],
    latitude: 40.755,
    longitude: -73.983,
  });
  const v2 = await service.onboardVendor({
    ownerUserId: "owner_2",
    name: "Tokyo Rice & Roll",
    description: "Fresh sushi and rice bowls",
    cuisineTags: ["japanese", "sushi"],
    latitude: 40.744,
    longitude: -73.979,
  });
  return { v1: v1.vendor, v2: v2.vendor };
}

test("onboardVendor adds vendor and listVendors returns it", async () => {
  const service = createService();
  const created = await service.onboardVendor({
    ownerUserId: "owner_1",
    name: "Saffron Street Kitchen",
    description: "Indian comfort food",
    cuisineTags: ["indian"],
    latitude: 40.751,
    longitude: -73.989,
  });

  const vendors = await service.listVendors();
  assert.equal(vendors.length, 1);
  assert.equal(vendors[0].vendorId, created.vendor.vendorId);
  assert.equal(vendors[0].name, "Saffron Street Kitchen");
});

test("upsertVendorMenu then getVendorMenu returns updated sections", async () => {
  const service = createService();
  const created = await service.onboardVendor({
    ownerUserId: "owner_1",
    name: "Menu House",
    description: "Good food",
    cuisineTags: ["fusion"],
    latitude: 40.75,
    longitude: -73.98,
  });

  const menu = await service.upsertVendorMenu({
    vendorId: created.vendor.vendorId,
    sections: [
      {
        sectionId: "sec_1",
        title: "Mains",
        items: [
          {
            itemId: "itm_1",
            name: "Rice Bowl",
            description: "Test item",
            priceCents: 1299,
            isAvailable: true,
          },
        ],
      },
    ],
  });
  const fetched = await service.getVendorMenu(created.vendor.vendorId);

  assert.equal(menu.sections.length, 1);
  assert.equal(fetched.sections[0].title, "Mains");
  assert.equal(fetched.sections[0].items[0].itemId, "itm_1");
});

test("searchVendors ranks text matches and respects geo radius", async () => {
  const service = createService();
  const { v1, v2 } = await onboardSampleVendors(service);

  const result = await service.searchVendors("pizza", 40.755, -73.983, 1, 10);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].vendor.vendorId, v1.vendorId);
  assert.equal(result.items[0].vendor.vendorId !== v2.vendorId, true);
});

test("nearbyVendors enforces radius and does not include distant vendor", async () => {
  const service = createService();
  const { v1, v2 } = await onboardSampleVendors(service);

  const nearV1 = await service.nearbyVendors(40.755, -73.983, 0.4, 20);
  const ids = new Set(nearV1.items.map((item) => item.vendor.vendorId));

  assert.equal(ids.has(v1.vendorId), true);
  assert.equal(ids.has(v2.vendorId), false);
});

test("getVendorMenu throws when vendor has no menu", async () => {
  const service = createService();
  await assert.rejects(
    () => service.getVendorMenu("vnd_missing"),
    NotFoundException,
  );
});
