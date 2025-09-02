import Joi from 'joi';
import { createValidator } from 'express-joi-validation';

const validator = createValidator();

const createChatSchema = Joi.object({
  recipientId: Joi.string().hex().length(24).required()
});

const createGroupChatSchema = Joi.object({
  groupname: Joi.string().min(1).max(50).required(),
  groupicon: Joi.string().uri().optional(),
  members: Joi.array().items(Joi.string().hex().length(24)).min(2).required()
});

export const validateCreateChat = validator.body(createChatSchema);
export const validateCreateGroupChat = validator.body(createGroupChatSchema);
