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
import { getSettingsChatID, getUsers, setUsers } from "./settings.ts";

export enum StartError {
  NOT_START_SETTINGS = "NOT_START_SETTINGS",
  NOT_SETTINGS_CHAT = "NOT_SETTINGS_CHAT",
  NO_START_SETTINGS = "NO_START_SETTINGS",
  NO_SETTINGS_CHAT = "NO_SETTINGS_CHAT",
  NO_GREETING_SET = "NO_GREETING_SET",
  NO_MESSAGE = "NO_MESSAGE",
}

export interface Greeting {
  chatID: number;
  messageID: number;
}

/**
 * Returns bot's start settings thread in the settings chat.
 *
 * @throws {@link SettingsError.NO_START_SETTINGS}
 * Thrown if the bot doesn't have a specified settings thread.
 *
 * @public
 */
export async function getStartSettingsThreadID(ctx: Context): Promise<number> {
  const kv = await KV.instance.init();

  const greeting = await kv.get([
    "handy",
    "handlers",
    "start",
    "settings",
    ctx.me.id,
    "settingsThreadID",
  ]) as number | null;

  if (!greeting) throw new Error(StartError.NO_START_SETTINGS);
  return greeting;
}

/**
 * Sets the bot's start settings thread ID.
 *
 * @throws {@link StartError.NO_SETTINGS_CHAT}
 * Thrown if the bot doesn't have a specified settings chat.
 *
 * @public
 */
export async function setStartSettingsThreadID(
  ctx: Context,
  threadID: number,
): Promise<void> {
  const kv = await KV.instance.init();

  await getSettingsChatID(ctx);
  await kv.set(
    [
      "handy",
      "handlers",
      "start",
      "settings",
      ctx.me.id,
      "settingsThreadID",
    ],
    threadID,
  );
}

/**
 * Returns bot's greeting.
 *
 * @throws {@link StartError.NO_GREETING_SET}
 * Thrown if the bot doesn't have a set greeting.
 *
 * @public
 */
export async function getGreeting(ctx: Context): Promise<Greeting> {
  const kv = await KV.instance.init();

  const greeting = await kv.get([
    "handy",
    "handlers",
    "start",
    "settings",
    ctx.me.id,
    "greeting",
  ]) as Greeting | null;

  if (!greeting) throw new Error(StartError.NO_GREETING_SET);
  return greeting;
}

/**
 * Sets the bot's greeting.
 *
 * @throws {@link StartError.NO_SETTINGS_CHAT}
 * Thrown if the bot doesn't have a specified settings chat.
 *
 * @throws {@link StartError.NOT_SETTINGS_CHAT}
 * Thrown if the update comes from a chat that is not the settings chat.
 *
 * @throws {@link StartError.NOT_START_SETTINGS}
 * Thrown if the update comes from a topic that is not for start settings.
 *
 * @throws {@link StartError.NO_MESSAGE}
 * Thrown if there was no message in the update.
 *
 * @public
 */
export async function setGreeting(ctx: Context): Promise<void> {
  const kv = await KV.instance.init();

  if (!ctx.message) throw new Error(StartError.NO_MESSAGE);

  const settingsChatID = await getSettingsChatID(ctx);
  if (ctx.message.chat.id !== settingsChatID) {
    throw new Error(StartError.NOT_SETTINGS_CHAT);
  }

  const settingsThreadID = await getStartSettingsThreadID(ctx);
  if (ctx.message.message_thread_id !== settingsThreadID) {
    throw new Error(StartError.NOT_START_SETTINGS);
  }

  await kv.set(
    [
      "handy",
      "handlers",
      "start",
      "settings",
      ctx.me.id,
      "greeting",
    ],
    {
      chatID: ctx.message.chat.id,
      messageID: ctx.message.message_id,
    },
  );
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

  try {
    const greeting = await getGreeting(ctx);
    await ctx.api.copyMessage(
      ctx.message.chat.id,
      greeting.chatID,
      greeting.messageID,
    );
  } catch (err) {
    if ((err as Error).message === StartError.NO_GREETING_SET) {
      await ctx.reply("Hello! You can ask your questions here.");
    } else {
      throw err;
    }
  }

  const users = await getUsers(ctx);
  if (!users.includes(ctx.message.from.id as number)) {
    users.push(ctx.message.from.id);
  }
  await setUsers(ctx, users);
}
