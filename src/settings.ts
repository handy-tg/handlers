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
import type { ChatMemberAdministrator } from "grammyTypes";

import { KV } from "./_kv.ts";

export enum SettingsError {
  NO_SETTINGS_CHAT = "NO_SETTINGS_CHAT",
  TOPICS_NOT_ENABLED = "TOPICS_NOT_ENABLED",
  CHAT_NOT_SUPERGROUP = "CHAT_NOT_SUPERGROUP",
  CANNOT_MANAGE_TOPICS = "CANNOT_MANAGE_TOPICS",
  CHAT_ALREADY_SETTINGS_CHAT = "CHAT_ALREADY_SETTINGS_CHAT",
}

/**
 * Returns bot's settings chat.
 *
 * @throws {@link SettingsError.NO_SETTINGS_CHAT}
 * Thrown if the bot doesn't have a specified settings chat.
 *
 * @public
 */
export async function getSettingsChatID(ctx: Context): Promise<number> {
  const kv = await KV.instance.init();

  const settingsChatID = await kv.get([
    "handy",
    "handlers",
    "settings",
    ctx.me.id,
    "settingsChatID",
  ]) as number | null;
  if (!settingsChatID) throw new Error(SettingsError.NO_SETTINGS_CHAT);

  return settingsChatID;
}

/**
 * Sets chat in the update as bot's settings chat.
 *
 * @remarks
 * The chat must be a supergroup with topics enabled and the bot
 * must be an admin able to manage topics.
 *
 * @throws {@link SettingsError.CHAT_NOT_SUPERGROUP}
 * Thrown if the chat is not a supergroup.
 *
 * @throws {@link SettingsError.TOPICS_NOT_ENABLED}
 * Thrown if the chat doesn't have topics enabled.
 *
 * @throws {@link SettingsError.CANNOT_MANAGE_TOPICS}
 * Thrown if the bot cannot manage topics in the chat.
 *
 * @throws {@link SettingsError.CHAT_ALREADY_SETTINGS_CHAT}
 * Thrown if the current chat is already bot's settings chat.
 *
 * @public
 */
export async function setSettingsChatID(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== "supergroup") {
    throw new Error(SettingsError.CHAT_NOT_SUPERGROUP);
  }

  const chatInfo = await ctx.getChat();
  if (!chatInfo.is_forum) {
    throw new Error(SettingsError.TOPICS_NOT_ENABLED);
  }

  const chatMember = await ctx.api.getChatMember(ctx.chat.id, ctx.me.id);
  if (
    chatMember.status !== "administrator" ||
    !(chatMember as ChatMemberAdministrator).can_manage_topics
  ) {
    throw new Error(SettingsError.CANNOT_MANAGE_TOPICS);
  }

  let oldSettingsChatID: number | undefined;
  try {
    oldSettingsChatID = await getSettingsChatID(ctx);
  } catch (err) {
    if ((err as Error).message !== SettingsError.NO_SETTINGS_CHAT) {
      throw err;
    }
  }
  if (ctx.chat.id === oldSettingsChatID) {
    throw new Error(SettingsError.CHAT_ALREADY_SETTINGS_CHAT);
  }

  const kv = await KV.instance.init();
  await kv.set(
    [
      "handy",
      "handlers",
      "settings",
      ctx.me.id,
      "settingsChatID",
    ],
    ctx.chat.id,
  );
}

/**
 * Checks if the update was received from bot's settings chat.
 *
 * @public
 */
export async function isSettingsChatUpdate(ctx: Context): Promise<boolean> {
  if (ctx.chat?.type !== "supergroup") return false;
  let settingsChatID;

  try {
    settingsChatID = await getSettingsChatID(ctx);
  } catch (err) {
    if ((err as Error).message !== SettingsError.NO_SETTINGS_CHAT) throw err;
  }

  return ctx.chat.id === settingsChatID;
}

/**
 * Returns bot's users.
 *
 * @public
 */
export async function getUsers(ctx: Context): Promise<number[]> {
  const kv = await KV.instance.init();

  const users = await kv.get([
    "handy",
    "handlers",
    "settings",
    ctx.me.id,
    "users",
  ]) as number[] | null;

  return users || [];
}

/**
 * Sets the bot's users.
 *
 * @public
 */
export async function setUsers(ctx: Context, users: number[]): Promise<void> {
  const kv = await KV.instance.init();

  await getSettingsChatID(ctx);
  await kv.set(
    [
      "handy",
      "handlers",
      "settings",
      ctx.me.id,
      "users",
    ],
    users,
  );
}
