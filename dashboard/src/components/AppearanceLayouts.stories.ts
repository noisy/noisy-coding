import type { Meta, StoryObj } from '@storybook/vue3';
import AppearanceLayouts from './AppearanceLayouts.vue';
const meta: Meta<typeof AppearanceLayouts> = {
  title: 'Product/Appearance layouts', component: AppearanceLayouts,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof AppearanceLayouts>;
export const Split: Story = { name: '1 · Controls left, preview right', args: { layout: 'split' } };
export const PreviewFirst: Story = { name: '2 · Preview above controls', args: { layout: 'preview-first' } };
export const Workbench: Story = { name: '3 · Accent, conversation, avatar gallery', args: { layout: 'workbench' } };

export const Combined: Story = { name: '4 · Combined — preview and original avatar browser', args: { layout: 'combined' } };
