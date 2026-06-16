import type { Core } from '@strapi/strapi';

const config = (): Core.Config.Plugin => ({
  upload: {
    config: {
      provider: '@strapi/provider-upload-aws-s3',
      providerOptions: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
        endpoint: process.env.R2_ENDPOINT,
        region: 'auto',
        params: {
          Bucket: process.env.R2_BUCKET,
        },
        baseUrl: `${process.env.CDN_URL}/${process.env.R2_BUCKET}`,
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});

export default config;
