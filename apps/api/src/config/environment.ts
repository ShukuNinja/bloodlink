import * as Joi from 'joi';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .invalid(Joi.ref('JWT_REFRESH_SECRET'))
    .required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .pattern(/^[1-9]\d{0,5}[smhd]$/)
    .required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^[1-9]\d{0,5}[smhd]$/)
    .required(),
});
