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

export enum ContactError {
  CHAT_ALREADY_CONTACT_CHAT = "CHAT_ALREADY_CONTACT_CHAT",
  CANNOT_MANAGE_TOPICS = "CANNOT_MANAGE_TOPICS",
  CHAT_NOT_SUPERGROUP = "CHAT_NOT_SUPERGROUP",
  TOPICS_NOT_ENABLED = "TOPICS_NOT_ENABLED",
  NOT_TOPIC_MESSAGE = "NOT_TOPIC_MESSAGE",
  NOT_CONTACT_CHAT = "NOT_CONTACT_CHAT",
  NO_CONTACT_CHAT = "NO_CONTACT_CHAT",
  NO_TOPIC_USER = "NO_TOPIC_USER",
  BOT_NOT_ADMIN = "BOT_NOT_ADMIN",
}

async function getContactChatID(ctx: Context): Promise<number> {
  const kv = await KV.instance.init();

  const contactChatID = await kv.get([
    "handy",
    "handlers",
    "contact",
    "settings",
    ctx.me.id,
    "contactChatID",
  ]) as number | null;
  if (!contactChatID) throw new Error(ContactError.NO_CONTACT_CHAT);

  return contactChatID;
}

async function getChatTopicID(
  ctx: Context,
  contactChatID: number,
): Promise<number> {
  const chatID = ctx.chat?.id as number;

  const kv = await KV.instance.init();

  const chatTopicID = await kv.get([
    "handy",
    "handlers",
    "contact",
    "data",
    ctx.me.id,
    contactChatID,
    "topic-by-user",
    chatID,
  ]) as number | null;
  if (chatTopicID) return chatTopicID;

  const topic = await ctx.api.createForumTopic(contactChatID, "name");
  const topicID = topic.message_thread_id;

  await kv.set(
    [
      "handy",
      "handlers",
      "contact",
      "data",
      ctx.me.id,
      contactChatID,
      "topic-by-user",
      chatID,
    ],
    topicID,
  );
  await kv.set(
    [
      "handy",
      "handlers",
      "contact",
      "data",
      ctx.me.id,
      contactChatID,
      "user-by-topic",
      topicID,
    ],
    chatID,
  );

  return topicID;
}

async function getTopicChatID(
  ctx: Context,
  contactChatID: number,
): Promise<number> {
  const threadID = ctx.message?.message_thread_id as number;

  const kv = await KV.instance.init();
  const topicChatID = await kv.get([
    "handy",
    "handlers",
    "contact",
    "data",
    ctx.me.id,
    contactChatID,
    "user-by-topic",
    threadID,
  ]) as number | null;

  if (!topicChatID) throw new Error(ContactError.NO_TOPIC_USER);
  return topicChatID;
}

/**
 * Checks if the update was received from bot's contact chat.
 *
 * @public
 */
export async function isContactChatUpdate(ctx: Context): Promise<boolean> {
  if (ctx.chat?.type !== "supergroup") return false;
  let contactChatID;

  try {
    contactChatID = await getContactChatID(ctx);
  } catch (err) {
    if ((err as Error).message !== ContactError.NO_CONTACT_CHAT) throw err;
  }

  return ctx.chat.id === contactChatID;
}

/**
 * Forward a message from the admin to the user.
 *
 * @remarks
 * Messages that are not sent to topics in in saved contact chat are ignored.
 * Messages from banned users are ignored as well.
 *
 * @throws {@link ContactError.NO_CONTACT_CHAT}
 * Thrown if the bot doesn't have an associated contact chat.
 *
 * @public
 */
export async function messageToAdmin(ctx: Context): Promise<void> {
  if (ctx.message?.chat.type !== "private") return;
  if (await isUserBanned(ctx, ctx.message.chat.id)) return;
  const contactChatID = await getContactChatID(ctx);
  const chatTopicID = await getChatTopicID(ctx, contactChatID);
  await ctx.copyMessage(contactChatID, { message_thread_id: chatTopicID });
}

/**
 * Forward a message from a user to the admin.
 *
 * @remarks
 * Messages that are not sent to bot's contact chat are ignored.
 *
 * @throws {@link ContactError.NO_CONTACT_CHAT}
 * Thrown if the bot does not have an associated contact chat.
 *
 * @public
 */
export async function messageToUser(ctx: Context): Promise<void> {
  if (ctx.message?.chat.type !== "supergroup") return;

  let contactChatID;

  try {
    contactChatID = await getContactChatID(ctx);
  } catch (err) {
    if ((err as Error).message === ContactError.NO_CONTACT_CHAT) return;
    throw err;
  }

  if (ctx.message.chat.id !== contactChatID) return;
  if (!ctx.message.is_topic_message) return;

  const topicChatID = await getTopicChatID(ctx, contactChatID);
  await ctx.copyMessage(topicChatID);
}

/**
 * Sets chat in the update as bot's contact chat.
 *
 * @remarks
 * The chat must be a supergroup with topics enabled and the bot
 * must be an admin able to manage topics.
 *
 * @throws {@link ContactError.CHAT_NOT_SUPERGROUP}
 * Thrown if the chat is not a supergroup.
 *
 * @throws {@link ContactError.TOPICS_NOT_ENABLED}
 * Thrown if the chat doesn't have topics enabled.
 *
 * @throws {@link ContactError.CANNOT_MANAGE_TOPICS}
 * Thrown if the bot cannot manage topics in the chat.
 *
 * @throws {@link ContactError.CHAT_ALREADY_CONTACT_CHAT}
 * Thrown if the current chat is already bot's contact chat.
 *
 * @public
 */
export async function setContactChatID(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== "supergroup") {
    throw new Error(ContactError.CHAT_NOT_SUPERGROUP);
  }

  const chatInfo = await ctx.getChat();
  if (!chatInfo.is_forum) {
    throw new Error(ContactError.TOPICS_NOT_ENABLED);
  }

  const chatMember = await ctx.api.getChatMember(ctx.chat.id, ctx.me.id);
  if (
    chatMember.status !== "administrator" ||
    !(chatMember as ChatMemberAdministrator).can_manage_topics
  ) {
    throw new Error(ContactError.CANNOT_MANAGE_TOPICS);
  }

  let oldContactChatID: number | undefined;
  try {
    oldContactChatID = await getContactChatID(ctx);
  } catch (err) {
    if ((err as Error).message !== ContactError.NO_CONTACT_CHAT) {
      throw err;
    }
  }
  if (ctx.chat.id === oldContactChatID) {
    throw new Error(ContactError.CHAT_ALREADY_CONTACT_CHAT);
  }

  const kv = await KV.instance.init();
  await kv.set(
    [
      "handy",
      "handlers",
      "contact",
      "settings",
      ctx.me.id,
      "contactChatID",
    ],
    ctx.chat.id,
  );
}

/**
 * Ban a user from contact chat's topic.
 *
 * @remarks
 * Any new message sent by the user will not be forwarded to the contact chat.
 *
 * @throws {@link ContactError.NO_CONTACT_CHAT}
 * Thrown if the bot doesn't have a contact chat specified.
 *
 * @throws {@link ContactError.NO_TOPIC_USER}
 * Thrown if topic in the chat doesn't have its associated user.
 *
 * @throws {@link ContactError.NOT_CONTACT_CHAT}
 * Thrown if this command wasn't sent in the contact chat.
 *
 * @throws {@link ContactError.NOT_TOPIC_MESSAGE}
 * Thrown if this command wasn't sent in a topic.
 *
 * @public
 */
export async function banUser(ctx: Context): Promise<void> {
  const contactChatID = await getContactChatID(ctx);

  if (ctx.message?.chat.id !== contactChatID) {
    throw new Error(ContactError.NOT_CONTACT_CHAT);
  }
  if (!ctx.message.is_topic_message) {
    throw new Error(ContactError.NOT_TOPIC_MESSAGE);
  }

  const topicChatID = await getTopicChatID(ctx, contactChatID);

  const kv = await KV.instance.init();
  await kv.set([
    "handy",
    "handlers",
    "contact",
    "data",
    ctx.me.id,
    "bannedUser",
    topicChatID,
  ], true);
}

/**
 * Unban a user from contact chat's topic.
 *
 * @remarks
 * Any new message sent by the user will be forwarded to the contact chat.
 *
 * @throws {@link ContactError.NO_CONTACT_CHAT}
 * Thrown if the bot doesn't have a contact chat specified.
 *
 * @throws {@link ContactError.NO_TOPIC_USER}
 * Thrown if topic in the chat doesn't have its associated user.
 *
 * @throws {@link ContactError.NOT_CONTACT_CHAT}
 * Thrown if this command wasn't sent in the contact chat.
 *
 * @throws {@link ContactError.NOT_TOPIC_MESSAGE}
 * Thrown if this command wasn't sent in a topic.
 *
 * @public
 */
export async function unbanUser(ctx: Context): Promise<void> {
  const contactChatID = await getContactChatID(ctx);

  if (ctx.message?.chat.id !== contactChatID) {
    throw new Error(ContactError.NOT_CONTACT_CHAT);
  }
  if (!ctx.message.is_topic_message) {
    throw new Error(ContactError.NOT_TOPIC_MESSAGE);
  }

  const topicChatID = await getTopicChatID(ctx, contactChatID);

  const kv = await KV.instance.init();
  await kv.delete([
    "handy",
    "handlers",
    "contact",
    "data",
    ctx.me.id,
    "bannedUser",
    topicChatID,
  ]);
}

/**
 * Checks if user with provided ID is banned.
 *
 * @public
 */
export async function isUserBanned(
  ctx: Context,
  userID: number,
): Promise<boolean> {
  const kv = await KV.instance.init();
  return await kv.get([
    "handy",
    "handlers",
    "contact",
    "data",
    ctx.me.id,
    "bannedUser",
    userID,
  ]) as boolean | null || false;
}
