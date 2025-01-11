// Handy TG handlers - helpers to create a useful Telegram bot.
// Copyright (C) 2025 Handy TG. <https://github.com/handy-tg>

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

export class KV {
  private static _instance: KV;

  private kv: Deno.Kv | undefined;
  private cache: Map<Deno.KvKey, unknown>;

  public async init(): Promise<KV> {
    if (!this.kv) this.kv = await Deno.openKv();
    return this;
  }

  public async get(key: Deno.KvKey): Promise<unknown> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const kv = this.getKv();
    const item = await kv.get(key);
    this.cache.set(key, item.value);

    return item.value;
  }

  public async set(key: Deno.KvKey, value: unknown): Promise<void> {
    this.cache.set(key, value);

    const kv = this.getKv();
    await kv.set(key, value);
  }

  public async delete(key: Deno.KvKey): Promise<void> {
    this.cache.delete(key);

    const kv = this.getKv();
    await kv.delete(key);
  }

  public async *all(prefix: Deno.KvKey): AsyncGenerator<unknown, void, void> {
    const kv = this.getKv();
    const items = kv.list({ prefix });

    for await (const item of items) {
      yield item.value;
    }
  }

  private constructor() {
    this.cache = new Map();
  }

  private getKv(): Deno.Kv {
    if (this.kv === undefined) throw new Error("KV was not initialized.");
    return this.kv;
  }

  public static get instance(): KV {
    return this._instance || (this._instance = new this());
  }
}
