import mongoose from "mongoose";
import { User, Equipment, Reservation, Activity, ACTIVE } from "./models.js";
import { fail, validateWindow } from "./validation.js";

async function record(reservation, actor, action, note, session) {
  await Activity.create(
    [
      {
        reservation: reservation._id,
        student: reservation.student,
        equipment: reservation.equipment,
        actor: actor._id,
        action,
        note,
      },
    ],
    { session },
  );
}
export async function createReservation(actor, input) {
  let result;
  await mongoose.connection.transaction(
    async (session) => {
      // Write before reading: concurrent requests conflict and retry with a fresh snapshot.
      await User.updateOne(
        { _id: actor._id },
        { $inc: { revision: 1 } },
        { session },
      );
      const item = await Equipment.findOneAndUpdate(
        { _id: input.equipment },
        { $inc: { revision: 1 } },
        { session, returnDocument: "after" },
      );
      if (!item) fail(404, "Equipment not found.");
      const start = new Date(input.start),
        end = new Date(input.end);
      validateWindow(start, end);
      const count = await Reservation.countDocuments({
        student: actor._id,
        status: { $in: ACTIVE },
      }).session(session);
      if (count >= 3)
        fail(
          409,
          "You already have three active reservations. Cancel or complete one first.",
        );
      const overlap = await Reservation.exists({
        equipment: item._id,
        status: { $in: ACTIVE },
        start: { $lt: end },
        end: { $gt: start },
      }).session(session);
      if (overlap)
        fail(
          409,
          "This equipment is reserved during part of that window. Choose different times.",
        );
      [result] = await Reservation.create(
        [
          {
            student: actor._id,
            equipment: item._id,
            purpose: input.purpose,
            start,
            end,
          },
        ],
        { session },
      );
      await record(result, actor, "created", "", session);
    },
    { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
  );
  return result;
}
export async function transition(actor, id, action, note = "") {
  let result;
  await mongoose.connection.transaction(
    async (session) => {
      // Every lifecycle mutation obtains the same item lock as creation.
      const initial = await Reservation.findById(id).session(session);
      if (!initial) fail(404, "Reservation not found.");
      if (
        actor.role !== "staff" &&
        String(initial.student) !== String(actor._id)
      )
        fail(404, "Reservation not found.");
      if (actor.role !== "staff" && action !== "cancel")
        fail(403, "Staff access required.");
      await User.updateOne(
        { _id: initial.student },
        { $inc: { revision: 1 } },
        { session },
      );
      await Equipment.updateOne(
        { _id: initial.equipment },
        { $inc: { revision: 1 } },
        { session },
      );
      const r = await Reservation.findById(id).session(session);
      const now = new Date();
      let event;
      if (action === "cancel") {
        if (!["pending", "approved"].includes(r.status))
          fail(409, "Only pending or approved requests can be cancelled.");
        r.status = event = "cancelled";
      } else if (action === "approve" || action === "reject") {
        if (r.status !== "pending")
          fail(409, "Only pending requests can be reviewed.");
        if (action === "approve" && r.start <= now)
          fail(
            409,
            "This reservation has already started and cannot be approved.",
          );
        r.status = event = action === "approve" ? "approved" : "rejected";
        r.staffNote = note;
      } else if (action === "checkout") {
        if (r.status !== "approved")
          fail(409, "Only approved requests can be checked out.");
        if (now < r.start || now >= r.end)
          fail(409, "Checkout is only allowed during the reservation window.");
        if (
          await Reservation.exists({
            equipment: r.equipment,
            status: "checked_out",
            _id: { $ne: r._id },
          }).session(session)
        )
          fail(
            409,
            "This item is still checked out by another borrower. Record its return first.",
          );
        r.status = event = "checked_out";
        r.checkedOutAt = now;
      } else if (action === "return") {
        if (r.status !== "checked_out")
          fail(409, "Only checked-out equipment can be returned.");
        r.status = event = "returned";
        r.returnedAt = now;
      } else fail(400, "Unknown action.");
      await r.save({ session });
      await record(r, actor, event, note, session);
      result = r;
    },
    { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
  );
  return result;
}
