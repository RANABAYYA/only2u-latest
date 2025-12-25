import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Only2U E-Commerce API',
      version: '1.0.0',
      description: 'REST API for Customer Master, Product Master, Sale Invoices, Cancellations, Payments, and Refunds',
      contact: {
        name: 'Only2U API Support',
        email: 'support@only2u.app',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000/api',
        description: 'Local development server',
      },
      {
        url: 'https://api.only2u.app/api',
        description: 'Production server',
      },
    ],
    components: {
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
        Customer: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            email: {
              type: 'string',
              nullable: true,
            },
            phone: {
              type: 'string',
            },
            billing_address: {
              type: 'string',
              nullable: true,
            },
            shipping_address: {
              type: 'string',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            sku: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
            description: {
              type: 'string',
              nullable: true,
            },
            price: {
              type: 'number',
              format: 'double',
            },
            mrp: {
              type: 'number',
              format: 'double',
              nullable: true,
            },
            currency: {
              type: 'string',
              example: 'INR',
            },
            stock_quantity: {
              type: 'integer',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
            },
            category: {
              type: 'string',
              nullable: true,
            },
            image_urls: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            invoice_number: {
              type: 'string',
            },
            customer_id: {
              type: 'string',
              format: 'uuid',
            },
            invoice_date: {
              type: 'string',
              format: 'date-time',
            },
            status: {
              type: 'string',
              enum: ['open', 'paid', 'cancelled', 'partially_paid', 'refunded'],
            },
            currency: {
              type: 'string',
            },
            subtotal: {
              type: 'number',
            },
            discount_amount: {
              type: 'number',
            },
            tax_amount: {
              type: 'number',
            },
            total_amount: {
              type: 'number',
            },
            paid_amount: {
              type: 'number',
            },
            balance_amount: {
              type: 'number',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        InvoiceItem: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            invoice_id: {
              type: 'string',
              format: 'uuid',
            },
            product_id: {
              type: 'string',
              format: 'uuid',
            },
            description: {
              type: 'string',
              nullable: true,
            },
            quantity: {
              type: 'integer',
            },
            unit_price: {
              type: 'number',
            },
            discount_amount: {
              type: 'number',
            },
            tax_amount: {
              type: 'number',
            },
            line_total: {
              type: 'number',
            },
          },
        },
        Cancellation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            invoice_id: {
              type: 'string',
              format: 'uuid',
            },
            reason: {
              type: 'string',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected'],
            },
            cancel_type: {
              type: 'string',
              enum: ['full', 'partial'],
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            approved_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
          },
        },
        CancellationItem: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            cancellation_id: {
              type: 'string',
              format: 'uuid',
            },
            invoice_item_id: {
              type: 'string',
              format: 'uuid',
            },
            quantity: {
              type: 'integer',
            },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            invoice_id: {
              type: 'string',
              format: 'uuid',
            },
            payment_date: {
              type: 'string',
              format: 'date-time',
            },
            amount: {
              type: 'number',
            },
            method: {
              type: 'string',
              enum: ['card', 'upi', 'netbanking', 'wallet', 'cod'],
              description: 'Payment method',
            },
            reference: {
              type: 'string',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['pending', 'success', 'failed', 'refunded'],
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Refund: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            invoice_id: {
              type: 'string',
              format: 'uuid',
            },
            cancellation_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            payment_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            refund_date: {
              type: 'string',
              format: 'date-time',
            },
            amount: {
              type: 'number',
            },
            method: {
              type: 'string',
              enum: ['card', 'upi', 'netbanking', 'wallet', 'cod'],
              description: 'Refund method',
            },
            reference: {
              type: 'string',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['pending', 'processed', 'failed'],
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
            },
            limit: {
              type: 'integer',
            },
            total: {
              type: 'integer',
            },
            totalPages: {
              type: 'integer',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/server.ts'], // Paths to files containing OpenAPI definitions
};

export const swaggerSpec = swaggerJsdoc(options);

