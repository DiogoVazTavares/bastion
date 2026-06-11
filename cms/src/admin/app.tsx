import {
  type Preset,
  StrapiMediaLib,
  StrapiUploadAdapter,
  setPluginConfig,
} from '@_sh/strapi-plugin-ckeditor';
import {
  Alignment,
  Bold,
  Essentials,
  GeneralHtmlSupport,
  Heading,
  Italic,
  Link,
  List,
  Paragraph,
  SourceEditing,
  Style,
  Underline,
} from 'ckeditor5';
// Loaded as a raw string (Vite ?raw) so the editor previews the 8 custom styles.
// Mirrors public/custom-styles.css, which the public site also serves to the rendered HTML.
import customStyles from '../../public/custom-styles.css?raw';

const bastionPreset: Preset = {
  name: 'bastion',
  description: 'Bastion HTML editor with custom styles',
  // Applied to the editing area after the theme — the CKEditor 5 / plugin equivalent
  // of CKEditor 4's `contentsCss`.
  styles: customStyles,
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
      Alignment,
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
      'alignment:left',
      'alignment:right',
      'alignment:center',
      'alignment:justify',
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
        { name: 'Text list', element: 'span', classes: ['text-list'] },
        { name: 'Titles', element: 'span', classes: ['titles'] },
        { name: 'Big text', element: 'span', classes: ['big-text'] },
        { name: 'Introduction', element: 'span', classes: ['introduction'] },
        { name: 'Caption', element: 'span', classes: ['caption'] },
        { name: 'Dark Button', element: 'span', classes: ['button', 'paragraph-image__button'] },
        { name: 'White Button', element: 'span', classes: ['contact__button'] },
      ],
    },
    htmlSupport: {
      allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
    },
  },
};

// Must be called at module load time — before any lifecycle hook fires.
setPluginConfig({ presets: [bastionPreset] });

export default {
  config: {
    locales: ['fr', 'nl'],
  },
};
