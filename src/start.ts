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

import type { Context } from "grammy";

import { KV } from "./_kv.ts";

async function getGreeting(ctx: Context): Promise<string> {
  const kv = await KV.instance.init();

  const greeting = await kv.get([
    "handy",
    "handlers",
    "start",
    "settings",
    ctx.me.id,
    "greeting",
  ]) as string | null;

  return greeting || "Hello! You can ask your questions here.";
}

/**
 * Handler to greet the user.
 *
 * @remarks
 * Only replies to private messages.
 *
 * @public
 */
export async function greet(ctx: Context): Promise<void> {
  if (ctx.message?.chat.type !== "private") return;
  const greeting = await getGreeting(ctx);
  await ctx.reply(greeting);
}
