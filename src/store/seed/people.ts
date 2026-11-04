import { CITIES, PHONE, POSTCODES, STREETS, TEAM, customerEmail } from "@/lib/brand";
import type { Customer, Person, StaffMember } from "../types";
import { plusMinutes, type Rng, zurich } from "./rng";

const FIRST = ["Lena", "Tim", "Sara", "Noah", "Mia", "Luca", "Nora", "Elias", "Lara", "David", "Alina", "Simon", "Emma", "Jan", "Julia", "Fabio", "Laura", "Marco", "Selina", "Reto", "Nina", "Beat", "Carla", "Ivo", "Tanja", "Urs", "Flavia", "Pascal", "Rahel", "Dario", "Vera", "Silvan", "Anouk", "Gian", "Livia", "Remo", "Svenja", "Oliver", "Ursina", "Timo"];
const LAST = ["Frei", "Baumann", "Graf", "Meier", "Vogel", "Roth", "Kunz", "Moser", "Wyss", "Lehmann", "Bucher", "Sutter", "Hofer", "Gerber", "Zaugg", "Marti", "Egli", "Suter", "Ammann", "Fuchs", "Widmer", "Bieri", "Kaufmann", "Portmann", "Schmid", "Rüegg", "Peter", "Keller", "Lüthi", "Bachmann", "Tobler", "Hug", "Aeschlimann", "Stalder", "Blum", "Haller", "Imhof", "Koch", "Rey", "Berger"];

const asciiName = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "");

export const ERASED_CUSTOMER_ID = "cus_erased";
export const ERASED_NAME = "Erased customer";

export function createCustomers(rng: Rng): Customer[] {
  const customers: Customer[] = FIRST.map((first, i) => {
    const last = LAST[i];
    const fullName = `${first} ${last}`;
    const created = zurich("2026-07-01", 9 + (i % 9), i % 60);
    return {
      id: `cus_${String(i + 1).padStart(3, "0")}`,
      fullName,
      email: customerEmail(asciiName(first), asciiName(last)),
      phone: PHONE,
      locale: rng.chance(0.7) ? "de" : "en",
      createdAt: plusMinutes(created, rng.int(0, 60 * 24 * 90)),
      erased: false,
      erasedAt: null,
      addresses: [{
        id: `adr_${i + 1}`,
        fullName,
        line1: STREETS[i % STREETS.length],
        postalCode: POSTCODES[i % POSTCODES.length],
        city: CITIES[i % CITIES.length],
        countryCode: "CH",
        phone: PHONE,
        isDefault: true,
      }],
      notes: [],
      waitlist: [],
    };
  });
  customers[0].notes.push({ id: "cn_1", body: "Called about a size swap. Sent the larger size on the next order.", author: "Lea Brunner", createdAt: zurich("2026-11-20", 11, 15) });
  customers[3].notes.push({ id: "cn_2", body: "Prefers TWINT and asks for no paper invoice.", author: "Mara Keller", createdAt: zurich("2026-12-02", 16, 40) });
  customers.push({
    id: ERASED_CUSTOMER_ID,
    fullName: ERASED_NAME,
    email: "erased@example.com",
    phone: "",
    locale: "de",
    createdAt: zurich("2026-07-15", 12),
    erased: true,
    erasedAt: zurich("2026-12-14", 9, 30),
    addresses: [],
    notes: [],
    waitlist: [],
  });
  return customers;
}

export function createTeam(): StaffMember[] {
  const seen: Record<Person, string> = {
    owner: zurich("2027-01-08", 8, 41),
    finance: zurich("2027-01-07", 17, 12),
    warehouse: zurich("2027-01-08", 7, 55),
    studio: zurich("2027-01-06", 10, 3),
  };
  return TEAM.map((m) => ({ profile: m.profile, name: m.name, initials: m.initials, roleEn: m.role.en, roleDe: m.role.de, isActive: true, lastSignInAt: seen[m.profile] }));
}

export const nameOf = (profile: Person): string => TEAM.find((m) => m.profile === profile)?.name ?? profile;
