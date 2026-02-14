const test = require("node:test");
const assert = require("node:assert/strict");
const { DeliveryService } = require("../dist/modules/delivery/delivery.service");

test("preview dispatch ranks couriers by distance and load", () => {
  const service = new DeliveryService();
  service.upsertLocation("courier-a", -1.286389, 36.817223);
  service.upsertLocation("courier-b", -1.29, 36.83);
  service.setCourierLoad("courier-a", 0);
  service.setCourierLoad("courier-b", 3);

  const preview = service.previewDispatch(-1.286389, 36.817223, 2);
  assert.equal(preview.candidates.length, 2);
  assert.equal(preview.candidates[0].courierId, "courier-a");
});
