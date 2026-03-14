import { randomUUID } from "crypto";
import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const LOCAL_DATA_DIRECTORY = path.join(process.cwd(), ".local-data", "ab-entertainment");

interface ContactInquiryInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

interface BookingRequestInput {
  eventSlug: string;
  eventTitle: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  unitAmount: number;
  currency: string;
  mode: "request" | "checkout";
}

interface NewsletterSubscriberRecord {
  id: string;
  email: string;
  status: "active";
  createdAt: string;
  updatedAt: string;
}

async function ensureLocalDataDirectory(): Promise<void> {
  await mkdir(LOCAL_DATA_DIRECTORY, { recursive: true });
}

async function appendJsonLine(filename: string, record: Record<string, unknown>) {
  await ensureLocalDataDirectory();
  const filePath = path.join(LOCAL_DATA_DIRECTORY, filename);
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(LOCAL_DATA_DIRECTORY, filename);
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await ensureLocalDataDirectory();
  const filePath = path.join(LOCAL_DATA_DIRECTORY, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function storeLocalContactInquiry(input: ContactInquiryInput) {
  const storedAt = new Date().toISOString();

  await appendJsonLine("contact-inquiries.jsonl", {
    id: randomUUID(),
    storedAt,
    ...input,
  });

  return { stored: true };
}

export async function upsertLocalNewsletterSubscriber(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const subscribers = await readJsonFile<NewsletterSubscriberRecord[]>(
    "newsletter-subscribers.json",
    []
  );
  const existingSubscriber = subscribers.find(
    (subscriber) => subscriber.email.toLowerCase() === normalizedEmail
  );
  const timestamp = new Date().toISOString();

  if (existingSubscriber) {
    existingSubscriber.status = "active";
    existingSubscriber.updatedAt = timestamp;
  } else {
    subscribers.push({
      id: randomUUID(),
      email: normalizedEmail,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  await writeJsonFile("newsletter-subscribers.json", subscribers);

  return {
    stored: true,
    alreadySubscribed: Boolean(existingSubscriber),
  };
}

export async function storeLocalBookingRequest(input: BookingRequestInput) {
  const storedAt = new Date().toISOString();

  await appendJsonLine("booking-requests.jsonl", {
    id: randomUUID(),
    storedAt,
    status: "captured",
    ...input,
  });

  return { stored: true };
}
