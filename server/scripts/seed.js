import { connectDB } from "../src/db.js";
import { Equipment } from "../src/models.js";
import mongoose from "mongoose";
export const items = [
  {
    assetTag: "CAM-001",
    name: "Canon EOS 200D II",
    category: "Cameras",
    description:
      "A lightweight DSLR for short films, campus events, and photo essays. Includes an 18–55mm lens, battery, charger, and carry bag.",
    location: "Media Lab · Block A, Room 104",
    specs: ["24.1 MP sensor", "Full HD video", "18–55mm lens"],
  },
  {
    assetTag: "AUD-001",
    name: "RØDE Wireless GO II",
    category: "Audio",
    description:
      "A two-person wireless microphone kit for interviews, podcasts, and student documentaries. Includes two transmitters, receiver, and cables.",
    location: "Media Lab · Block A, Room 104",
    specs: ["Dual channel", "200m range", "Onboard recording"],
  },
  {
    assetTag: "PRJ-001",
    name: "Epson EB-X49 Projector",
    category: "Presentation",
    description:
      "A bright portable projector for class presentations, club meetings, and screenings. HDMI cable, remote, and power cable included.",
    location: "AV Desk · Library, Ground Floor",
    specs: ["3,600 lumens", "HDMI input", "XGA resolution"],
  },
  {
    assetTag: "KIT-001",
    name: "Arduino Uno Starter Kit",
    category: "Electronics",
    description:
      "Build your next prototype with an Arduino Uno, breadboard, jumper wires, LEDs, resistors, and a selection of sensors.",
    location: "Innovation Hub · Block C, Room 208",
    specs: ["Arduino Uno R3", "15 project components", "USB cable included"],
  },
  {
    assetTag: "CAM-002",
    name: "Sony ZV-E10",
    category: "Cameras",
    description:
      "A mirrorless camera built for video projects and content creation. Comes with a 16–50mm kit lens, battery, and charger.",
    location: "Media Lab · Block A, Room 104",
    specs: ["4K video", "APS-C sensor", "16–50mm lens"],
  },
  {
    assetTag: "ACC-001",
    name: "Manfrotto Compact Tripod",
    category: "Accessories",
    description:
      "A stable, easy-to-carry tripod for cameras and small video setups. Quick-release plate and travel bag included.",
    location: "Equipment Store · Block B, Room 012",
    specs: ["1.5kg payload", "155cm max height", "Quick-release plate"],
  },
];
try {
  await connectDB();
  for (const item of items)
    await Equipment.updateOne(
      { assetTag: item.assetTag },
      { $setOnInsert: item },
      { upsert: true },
    );
  console.log(
    "Six equipment items seeded. Existing records and reservations preserved.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
