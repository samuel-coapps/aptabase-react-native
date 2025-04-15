import type { Event, Storage } from "./types";
import { EnvironmentInfo } from "./env";

const STORAGE_KEY = "APTABASE_REACT_NATIVE_EVENTS";

export class EventDispatcher {
  private _events: Event[] = [];
  private MAX_BATCH_SIZE = 25;
  private MAX_BATCHES_TO_LOAD = 100;
  private headers: Headers;
  private apiUrl: string;
  private storage: Storage;
  private isFlushing: boolean = false;

  constructor(appKey: string, baseUrl: string, env: EnvironmentInfo, storage: Storage) {
    this.apiUrl = `${baseUrl}/api/v0/events`;
    this.headers = new Headers({
      "Content-Type": "application/json",
      "App-Key": appKey,
      "User-Agent": `${env.osName}/${env.osVersion} ${env.locale}`,
    });
    this.storage = storage;

    try {
      const storedEvents = storage.getString(STORAGE_KEY);
      const restored = JSON.parse(storedEvents || "[]");
      this._events = Array.isArray(restored)
        ? restored.slice(-this.MAX_BATCH_SIZE * this.MAX_BATCHES_TO_LOAD)
        : [];
    } catch (e) {
      console.error(e);
      this._events = [];
    }
  }

  public enqueue(evt: Event | Event[]) {
    if (Array.isArray(evt)) {
      this._events.push(...evt);
    } else {
      this._events.push(evt);
    }

    const serializedEvents = JSON.stringify(this._events);
    this.storage.set(STORAGE_KEY, serializedEvents);
  }

  public async flush(): Promise<void> {
    if (this.isFlushing || this._events.length === 0) {
      return;
    }
    this.isFlushing = true;

    try {
      let failedEvents: Event[] = [];
      do {
        const eventsToSend = this._events.splice(0, this.MAX_BATCH_SIZE);
        try {
          await this._sendEvents(eventsToSend);
        } catch {
          failedEvents = [...failedEvents, ...eventsToSend];
        }
      } while (this._events.length > 0);

      if (failedEvents.length > 0) {
        this.enqueue(failedEvents);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private async _sendEvents(events: Event[]): Promise<void> {
    try {
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: this.headers,
        credentials: "omit",
        body: JSON.stringify(events),
      });

      if (res.status < 300) {
        return Promise.resolve();
      }

      const reason = `${res.status} ${await res.text()}`;
      if (res.status < 500) {
        console.warn(
          `Aptabase: Failed to send ${events.length} events because of ${reason}. Will not retry.`
        );
        return Promise.resolve();
      }

      throw new Error(reason);
    } catch (e) {
      console.error(`Aptabase: Failed to send ${events.length} events. Reason: ${e}`);
      throw e;
    }
  }
}
