import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'Only2U WhatsApp Authentication API',
            version: '1.0.0',
            description: 'REST API for WhatsApp OTP Authentication',
            contact: {
                name: 'Only2U API Support',
                email: 'support@only2u.app',
            },
        },
        servers: [
            {
                url: 'http://localhost:4001/api',
                description: 'Local development server',
            },
            {
                url: 'https://auth-api.only2u.app/api',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                    description: 'API key for authentication',
                },
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Session token for authenticated requests',
                },
            },
            schemas: {
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false,
                        },
                        data: {
                            nullable: true,
                        },
                        error: {
                            type: 'object',
                            properties: {
                                code: {
                                    type: 'string',
                                },
                                message: {
                                    type: 'string',
                                },
                            },
                        },
                    },
                },
                SendOtpRequest: {
                    type: 'object',
                    required: ['phone'],
                    properties: {
                        phone: {
                            type: 'string',
                            description: 'Phone number with country code (e.g., +919876543210)',
                            example: '+919876543210',
                        },
                        countryCode: {
                            type: 'string',
                            description: 'Country code without + (optional, extracted from phone if not provided)',
                            example: '91',
                        },
                    },
                },
                SendOtpResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true,
                        },
                        data: {
                            type: 'object',
                            properties: {
                                otpId: {
                                    type: 'string',
                                    format: 'uuid',
                                    description: 'OTP session ID for verification',
                                },
                                expiresAt: {
                                    type: 'string',
                                    format: 'date-time',
                                    description: 'OTP expiration time',
                                },
                                message: {
                                    type: 'string',
                                    example: 'OTP sent successfully via WhatsApp',
                                },
                            },
                        },
                        error: {
                            nullable: true,
                        },
                    },
                },
                VerifyOtpRequest: {
                    type: 'object',
                    required: ['phone', 'otp'],
                    properties: {
                        phone: {
                            type: 'string',
                            description: 'Phone number with country code',
                            example: '+919876543210',
                        },
                        otp: {
                            type: 'string',
                            description: '6-digit OTP code',
                            example: '123456',
                            minLength: 6,
                            maxLength: 6,
                        },
                        otpId: {
                            type: 'string',
                            format: 'uuid',
                            description: 'OTP session ID from send-otp response (optional)',
                        },
                    },
                },
                VerifyOtpResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true,
                        },
                        data: {
                            type: 'object',
                            properties: {
                                verified: {
                                    type: 'boolean',
                                    example: true,
                                },
                                sessionToken: {
                                    type: 'string',
                                    description: 'Session token for authenticated requests',
                                },
                                expiresAt: {
                                    type: 'string',
                                    format: 'date-time',
                                    description: 'Session expiration time',
                                },
                                user: {
                                    type: 'object',
                                    properties: {
                                        phone: {
                                            type: 'string',
                                        },
                                        isNewUser: {
                                            type: 'boolean',
                                        },
                                    },
                                },
                            },
                        },
                        error: {
                            nullable: true,
                        },
                    },
                },
                RefreshTokenRequest: {
                    type: 'object',
                    required: ['sessionToken'],
                    properties: {
                        sessionToken: {
                            type: 'string',
                            description: 'Current session token',
                        },
                    },
                },
                RefreshTokenResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true,
                        },
                        data: {
                            type: 'object',
                            properties: {
                                sessionToken: {
                                    type: 'string',
                                    description: 'New session token',
                                },
                                expiresAt: {
                                    type: 'string',
                                    format: 'date-time',
                                },
                            },
                        },
                        error: {
                            nullable: true,
                        },
                    },
                },
                LogoutRequest: {
                    type: 'object',
                    required: ['sessionToken'],
                    properties: {
                        sessionToken: {
                            type: 'string',
                            description: 'Session token to invalidate',
                        },
                    },
                },
                LogoutResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true,
                        },
                        data: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'Logged out successfully',
                                },
                            },
                        },
                        error: {
                            nullable: true,
                        },
                    },
                },
            },
        },
        security: [{ ApiKeyAuth: [] }],
    },
    apis: [
        './dist/routes/*.js',
        './dist/server.js',
        './src/routes/*.ts',
        './src/server.ts',
    ],
};

export const swaggerSpec = swaggerJsdoc(options);
