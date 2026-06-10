import {
  Bold,
  Italic,
  Underline,
  Essentials,
  Heading,
  List,
  Link,
  Paragraph,
  SourceEditing,
  Style,
  GeneralHtmlSupport,
} from 'ckeditor5';
import { setPluginConfig, StrapiMediaLib, StrapiUploadAdapter } from '@_sh/strapi-plugin-ckeditor';

const bastionPreset = {
  name: 'bastion',
  description: 'Bastion HTML editor with custom styles',
  editorConfig: {
    licenseKey: 'GPL',
    plugins: [
      Bold,
      Italic,
      Underline,
      Essentials,
      Heading,
      List,
      Link,
      Paragraph,
      SourceEditing,
      Style,
      GeneralHtmlSupport,
      StrapiMediaLib,
      StrapiUploadAdapter,
    ],
    toolbar: [
      'heading',
      '|',
      'bold',
      'italic',
      'underline',
      '|',
      'style',
      '|',
      'bulletedList',
      'numberedList',
      '|',
      'link',
      'strapiMediaLib',
      '|',
      'sourceEditing',
      '|',
      'undo',
      'redo',
    ],
    style: {
      definitions: [
        { name: 'Smallcaps titles', element: 'span', classes: ['smallcaps-titles'] },
        { name: 'Text list',        element: 'span', classes: ['text-list'] },
        { name: 'Titles',           element: 'span', classes: ['titles'] },
        { name: 'Big text',         element: 'span', classes: ['big-text'] },
        { name: 'Introduction',     element: 'span', classes: ['introduction'] },
        { name: 'Caption',          element: 'span', classes: ['caption'] },
        { name: 'Dark Button',      element: 'span', classes: ['button', 'paragraph-image__button'] },
        { name: 'White Button',     element: 'span', classes: ['contact__button'] },
      ],
    },
    htmlSupport: {
      allow: [
        { name: /.*/, attributes: true, classes: true, styles: true },
      ],
    },
    contentsCss: ['/custom-styles.css'],
  },
};

// Must be called at module load time — before any lifecycle hook fires.
setPluginConfig({ presets: [bastionPreset] });

export default {
  config: {
    locales: ['fr', 'nl'],
  },
};
