// Import script for SeaHuts (large/small) and Boxes
// Run with: node scripts/import-seahuts-boxes.mjs
//
// Data source: CSV data from the old system.
// - Creates resources of type SeaHut (with size Large/Small) or Box
// - Tries to match owners to existing users by email
// - Sets occupantIds when a match is found

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGGMhp8H7pVuYeEM12DXMMAqptsTWTjOI",
  authDomain: "stegerholmenshamn.firebaseapp.com",
  projectId: "stegerholmenshamn",
  storageBucket: "stegerholmenshamn.firebasestorage.app",
  messagingSenderId: "885107364018",
  appId: "1:885107364018:web:ec26d4b61d610e5344b9ab",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── Raw data ─────────────────────────────────────────────

const clientsCSV = `
nr;items;name;address;postalcode;municipality;email;phone
3;3|47;Hanna Pääaho;Doppingvägen 8;438 38;Landvetter;hanna.paaaho@gmail.com;;
4;4;Lars Johansson;Stegelholmsv 16;421 67;Hönö;larsj5216@gmail.com;031-3223944;
5;5;Hung Tran;Vittens gata 6;421 65;Västra Frölunda;gb.i.eliasson@gmail.com;;
6;6;;;;;;;
7;7;Andreas Stockman;Cinnobergatan 17;421 65;Västra Frölunda;stockman.andreas89@gmail.com;0703-48 28 34;
8;8;Magnus Agar;Kapplandsgatan 82;414 78;Göteborg;magnus.agar@gmail.com;;
9;9;Tomas Penden;Öresjö Lövsjöberg;438 95;Hällingsjö;Tomas@penden.se;0700-400 834;
10;10;Jerry Ekdahl;Skogsrydsgatan 32;426 74;Göteborg;;;
12;12;Per Bjällmark;Rygatan 26A;431 63;Mölndal;perbjallmark@gmail.com;;
13;13|33;Emil Soomer;Lefflersgatan 2E;416 71;Göteborg;;;
15;15;Kjell Åsberg;Lyrfågelvägen 13;426 69;Västra Frölunda;kjellgunnar343@gmail.com;;
17;17;Jerker Rudin;Arkivgatan 1;411 34;Göteborg;rudinjerker@gmail.com;;
18;18|20;Thomas Rumell;Orustgatan 13B;414 74;Göteborg;thomas.rumell55@gmail.com;0705321921;
19;19;Erik Johansson;Norra Breviksvägen 39;421 67;Västra Frölunda;johansson.erik.r@gmail.com;;
21;21|95;Håkan Jonsson;Stegerholmsvägen 3;421 67;Västra Frölunda;hakan@nptab.se;0730370718;
22;22|94|96;Peter Ericsson;Banjogatan 33;421 46;Västra Frölunda;fericsson@gmail.com;073-507 55 27;
23;23|24;Michael Hammar;Rimfrostgatan 111;418 40;Göteborg;anders.hammar1960@gmail.com;070-344 94 54;
25;25;;;;;;;
26;26;;;;;;;
27;27;Martin Bohlin;Hällefudragatan 32;426 58;Västra Frölunda;martin.bohlin@bohlinbygg.se;;
28;28;Ulf Boström;Älvlea 17;423 72;Säve;ulf.advice.bostrom@gmail.com;;
29;29;Mats Eliasson;Spektrumsgatan 28;421 63;Västra Frölunda;;;
30;30|103;Alexandra Frölinghaus;Ugglumsv. 23B;433 62;Sävedalen;a.frolinghaus@gmail.com;;
31;31;;;;;;;
34;34;Andreas Haggärde;Paradisgatan 27K;41316;Göteborg;andreas@haggarde.se;073-5583253;
35;35|37;Berth Andersson;Klassikergatan 15;422 41;Hisings-backa;ewabert@gmail.com;0739-81 07 85;
36;36;Ove Hermasson;Marklandsgatan 25 lgh 1603;414 77;Göteborg;gunloghermansson@gmail.com;0706-459667;
39;39;Jan Hagwall;Sandlyckevägen 39;421 66;Västra Frölunda;hackenycken@icloud.com;;
40;40;Anna-Karin Zetterman;Stegerholmsvägen 8;421 67;Västra Frölunda;ak_zetterman@hotmail.com;;
41;41;Reiner Johansson;Distansgatan 33;421 72;Västra Frölunda;reijoh2@gmail.com;;
42;42;Okänd ägare fd Anders Wendin;;;;;;
43;43;;;;;;;
44;44;Ulla Löwenmark;Tjuvdalsliden 2;421 67;Västra Frölunda;ullalowenmark@gmail.com;;
46;46;Roger Elmersson;Stegerholmsvägen 7;421 67;Västra Frölunda;roger@hallingsjohus.se;;
48;48;Mats Karlsson;Breviksängar 19;421 67;Västra Frölunda;;;
49;49;Anders Ledin;Pilegården 7A;436 35;Askim;andersledinprivat@gmail.com;;
50;50;Christian Billgren;Norra Breviksvägen 31;421 67;Västra Frölunda;cbillgren@outlook.com;0706-045515;
51;51;Mikael Udd;Pilegården 1B;436 35;Askim;mikael.udd69@gmail.com;;
52;52;Sussane Rönneke;Textilvägen 10;435 39;Mölnlycke;;;
54;54;;;;;;;
55;55;Gabriell Skallsjö;Stegerholmsvägen 4;421 67;Västra Frölunda;gabriel.skallsjo@vgregion.se;;
56;56;Hans Lindblad;Torpansgata 5;421 67;Västra Frölunda;hanlind58@gmail.com;;
57;57;Yann Hervy;Eklanda Skog 42;43149;Mölndal;yann@hervy.se;;
58;58;Stig fagerberg;Traneredsvägen 52;426 47;Västra Frölunda;marianne.lindstrom2@hotmail.com;0706-955705;
60;60;Ove Jansson;N Dragspelegatan 24 LGH 1603;421 43;Västra Frölunda;oveva4243@outlook.com;070-847 18 91;
61;61;Ewa Wernlundh;Lerduvevägen 9;436 51;Hovås;eson82@msn.com;;
62;62;;;;;;;
63;63;Leif Schweitz;Tegnérsgatan 15;412 52;Göteborg;leif.schweitz@astrazeneca.com;0727 06 61 05;
64;64|65;Håkan Zetterling;Tjuvdalsvägen 6 A;421 67;Västra Frölunda;hakan.zetterling@telia.com;0705 30 62 03;
67;67;Jonas Voxberg;Lilla Öneredsvägen 48;421 59;Västra Frölunda;jonas.woxberg@maxm.se;0733 75 75 96;
69;69;Anders Frykholm;Mandolingatan 7;421 40;Västra Frölunda;;;
70;70;Stig Stråhle;Näsets Backaväg 30;421 66;Västra Frölunda;;;
72;72;Jonny Koch;Bergendalsvägen 30;443 51;Lerum;johnny.k@hotmail.se;;
73;73|87;Stegervikens Brygglag c/o Christian Stenberg;Breviks Ängar 17;421 67;Västra Frölunda;stegerviken@gmail.com;;
74;74;Börje Olsson;Torparegatan 22;441 65;Alingsås;brittlouiseo@gmail.com;0733-241222;
75;75;Ejve Nilsson;Börshultsvägen 1;511 95;Öxabäck;s.eive.nilsson@gmail.com;;
76;76;Ulf Ahlcrona;Västra Palettgatan 1;421 66;Västra Frölunda;ulf.ahlcrona@telia.com;0705-348964;
77;77;Bo Johansson;Bastebergsvägen 1;421 66;Västra Frölunda;bosse48@live.se;0705-284510;
78;78;Magnus Krook;Norra Breviksvägen 72;421 67;Västra Frölunda;;;
80;80|83;Peter Nyberg;Bastebergsvägen 7;421 66;Västra Frölunda;peter.nyberg@peab.se;;
82;82;Anna Hermansson;Skäpplandsgatan 1 vån 6;414 78;Göteborg;anna.e.hermansson@gmail.com;0702-47 63 96;
85;85;Kjell Pettersson;;;;;;
86;86;Jesper Barenfeld;Norra Breviksvägen 67;421 67;Västra Frölunda;jesper.barenfeld@outlook.com;0739028515;
88;88;Joakim Rang;Fogelmarksvägen 3;421 67;Västra Frölunda;joakimrang@hotmail.com;;
90;90;Gunnar Blomqvist;Lönmossevägen;436 39;Askim;Gunnar.Blomkvist@bilia.se;;
92;92;Dag Wedin;Råstensgatan 52A;416 52;Göteborg;dagwed@gmail.com;;
93;93;Henrik Lindgrén;Östra Palettgatan 3;421 66;Västra Frölunda;henrik.lindgren@fastighetsbyran.se;0704-204998;
100;100;Kristian Smidfelt;Bastebergsvägen 3;421 66;Västra Frölunda;kristian.smidfelt@vgregion.se;;
106;106;Heidar Hilmarsson;Stegerholmsvägen 32;421 67;Västra Frölunda;heidar.hilmarsson@gmail.com;;
`.trim();

const itemsCSV = `
nr;product;productNr
3;Stor sjöbod;2
4;Stor sjöbod;2
5;Stor sjöbod;2
6;Låda;3
7;Liten sjöbod;1
8;Liten sjöbod;1
9;Liten sjöbod;1
10;Låda;3
12;Låda;3
13;Låda;3
15;Låda;3
17;Stor sjöbod;2
18;Stor sjöbod;2
19;Låda;3
20;Låda;3
21;Låda;3
22;Låda;3
23;Stor sjöbod;2
24;Låda;3
25;Låda;3
26;Låda;3
27;Stor sjöbod;2
28;Stor sjöbod;2
29;Stor sjöbod;2
30;Stor sjöbod;2
31;Låda;3
33;Liten sjöbod;1
34;Låda;3
35;Liten sjöbod;1
36;Stor sjöbod;2
37;Liten sjöbod;1
39;Stor sjöbod;2
40;Stor sjöbod;2
41;Låda;3
42;Låda;3
43;Låda;3
44;Låda;3
46;Stor sjöbod;2
47;Stor sjöbod;2
48;Liten sjöbod;1
49;Stor sjöbod;2
50;Liten sjöbod;1
51;Låda;3
52;Låda;3
53;Låda;3
54;Låda;3
55;Liten sjöbod;1
56;Stor sjöbod;2
57;Stor sjöbod;2
58;Låda;3
60;Stor sjöbod;2
61;Låda;3
62;Låda;3
63;Låda;3
64;Liten sjöbod;1
65;Liten sjöbod;1
67;Liten sjöbod;1
69;Stor sjöbod;2
70;Stor sjöbod;2
72;Stor sjöbod;2
73;Stor sjöbod;2
74;Stor sjöbod;2
75;Stor sjöbod;2
76;Stor sjöbod;2
77;Stor sjöbod;2
78;Stor sjöbod;2
80;Stor sjöbod;2
82;Låda;3
83;Stor sjöbod;2
85;Stor sjöbod;2
86;Låda;3
87;Stor sjöbod;2
88;Stor sjöbod;2
90;Låda;3
92;Stor sjöbod;2
93;Stor sjöbod;2
94;Stor sjöbod;2
95;Liten sjöbod;1
96;Stor sjöbod;2
100;Låda;3
103;Låda;3
106;Låda;3
`.trim();

// ─── Parse CSV data ───────────────────────────────────────

function parseClients(csv) {
  const lines = csv.split("\n").slice(1); // skip header
  const map = {}; // itemNr -> client info
  for (const line of lines) {
    const [nr, items, name, address, postalcode, municipality, email, phone] = line.split(";");
    if (!nr || !items) continue;
    const itemNrs = items.split("|").map((s) => s.trim());
    const client = {
      name: name?.trim() || "",
      address: address?.trim() || "",
      postalcode: postalcode?.trim() || "",
      municipality: municipality?.trim() || "",
      email: email?.trim() || "",
      phone: phone?.trim() || "",
    };
    // Map each item number to this client
    for (const itemNr of itemNrs) {
      map[itemNr] = client;
    }
  }
  return map;
}

function parseItems(csv) {
  const lines = csv.split("\n").slice(1); // skip header
  return lines.map((line) => {
    const [nr, product] = line.split(";");
    return { nr: nr.trim(), product: product.trim() };
  });
}

// ─── Main import ──────────────────────────────────────────

async function run() {
  try {
    const clientMap = parseClients(clientsCSV);
    const items = parseItems(itemsCSV);

    console.log(`Parsed ${Object.keys(clientMap).length} client-item mappings`);
    console.log(`Parsed ${items.length} items to import\n`);

    // 1. Fetch existing users for email matching
    const usersSnap = await getDocs(collection(db, "users"));
    const usersByEmail = {};
    for (const u of usersSnap.docs) {
      const email = u.data().email?.toLowerCase();
      if (email) usersByEmail[email] = u.id;
    }
    console.log(`Loaded ${Object.keys(usersByEmail).length} users for email matching\n`);

    // 2. Check existing resources to avoid duplicates
    const resourcesSnap = await getDocs(collection(db, "resources"));
    const existingCodes = new Set();
    for (const r of resourcesSnap.docs) {
      existingCodes.add(r.data().markingCode);
    }

    // 3. Import each item as a resource
    let created = 0;
    let skipped = 0;
    let matched = 0;

    for (const item of items) {
      // Determine type and marking code
      let type, size, markingPrefix;
      if (item.product === "Stor sjöbod") {
        type = "SeaHut";
        size = "Large";
        markingPrefix = "SB";
      } else if (item.product === "Liten sjöbod") {
        type = "SeaHut";
        size = "Small";
        markingPrefix = "SB";
      } else if (item.product === "Låda") {
        type = "Box";
        size = null;
        markingPrefix = "L";
      } else {
        console.log(`  Unknown product: ${item.product} for item ${item.nr}`);
        continue;
      }

      const markingCode = `${markingPrefix}-${item.nr}`;

      if (existingCodes.has(markingCode)) {
        console.log(`  Skipping ${markingCode} (already exists)`);
        skipped++;
        continue;
      }

      // Find the client who owns this item
      const client = clientMap[item.nr];
      const hasOwner = client && client.name;

      // Try to match owner to a registered user by email
      let occupantIds = [];
      if (client?.email) {
        const userId = usersByEmail[client.email.toLowerCase()];
        if (userId) {
          occupantIds = [userId];
          matched++;
          console.log(`  ✓ Matched ${markingCode} owner "${client.name}" to user ${userId}`);
        }
      }

      const data = {
        type,
        markingCode,
        status: hasOwner ? "Occupied" : "Available",
        paymentStatus: "Unpaid",
        occupantIds,
        objectImageUrl: "",
      };

      // Add SeaHut size
      if (type === "SeaHut") {
        data.size = size;
      }

      // Store all owner data in occupant fields
      if (hasOwner) {
        // Split name into first and last (split on last space)
        const nameParts = client.name.trim().split(/\s+/);
        if (nameParts.length > 1) {
          data.occupantLastName = nameParts.pop();
          data.occupantFirstName = nameParts.join(" ");
        } else {
          data.occupantFirstName = client.name.trim();
          data.occupantLastName = "";
        }

        if (client.phone) data.occupantPhone = client.phone;
        if (client.email) data.occupantEmail = client.email;
        if (client.address) data.occupantAddress = client.address;
        // Combine postalcode + municipality into postal address
        const postalParts = [client.postalcode, client.municipality].filter(Boolean);
        if (postalParts.length > 0) {
          data.occupantPostalAddress = postalParts.join(" ");
        }
      }

      const id = crypto.randomUUID();
      await setDoc(doc(db, "resources", id), data);

      const sizeLabel = size ? ` (${size})` : "";
      console.log(`  Created ${markingCode} [${type}${sizeLabel}]${hasOwner ? ` — ${client.name}` : " (empty)"}`);
      created++;
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`Done! Created ${created} resources, skipped ${skipped}.`);
    console.log(`Matched ${matched} owners to existing users.`);
    console.log(`═══════════════════════════════════════`);

    // Summary by type
    const seaHutLarge = items.filter((i) => i.product === "Stor sjöbod").length;
    const seaHutSmall = items.filter((i) => i.product === "Liten sjöbod").length;
    const boxes = items.filter((i) => i.product === "Låda").length;
    console.log(`\nBreakdown: ${seaHutLarge} Large SeaHuts, ${seaHutSmall} Small SeaHuts, ${boxes} Boxes`);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
