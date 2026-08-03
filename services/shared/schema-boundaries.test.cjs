const assert = require("node:assert/strict");
const test = require("node:test");

const expectedModels = {
  identity: [
    "AdminLog",
    "IdentityInboxEvent",
    "IdentityOutboxEvent",
    "PasswordResetOtp",
    "PhoneOtp",
    "User",
  ],
  property: [
    "Amenity",
    "CommunityManagerArea",
    "PropertyOutboxEvent",
    "Room",
    "RoomAmenity",
    "RoomImage",
    "RoomVerification",
    "RoomVerificationDocument",
    "VerificationCheck",
  ],
  rental: [
    "Booking",
    "Contract",
    "ContractEvent",
    "Invoice",
    "Occupancy",
    "Payment",
    "RentalOutboxEvent",
    "RentalRoomSnapshot",
    "UtilityBill",
  ],
  community: [
    "CommunityOutboxEvent",
    "FavoriteRoom",
    "ResourceBooking",
    "Review",
    "SharedResource",
    "SharedSpaceActivity",
    "UserDeviceToken",
  ],
  preference: [
    "PreferenceOutboxEvent",
    "RoomInteraction",
    "user_lifestyle_profiles",
    "user_preferences",
  ],
};

const clients = {
  identity: require("../identity-service/generated/client").Prisma,
  property: require("../property-service/generated/client").Prisma,
  rental: require("../rental-service/generated/client").Prisma,
  community: require("../community-service/generated/client").Prisma,
  preference: require("../preference-service/generated/client").Prisma,
};

for (const [service, prisma] of Object.entries(clients)) {
  test(`${service} Prisma client contains only its owned models`, () => {
    const actual = prisma.dmmf.datamodel.models.map((model) => model.name).sort();
    assert.deepEqual(actual, [...expectedModels[service]].sort());
  });
}
