export default async function(ctx) {
  // 1. 处理小尺寸组件（文档要求）
  if (['systemSmall', 'accessoryCircular', 'accessoryInline', 'accessoryRectangular'].includes(ctx.widgetFamily)) {
    return {
      type: 'widget',
      padding: 16,
      backgroundColor: '#2C2C2E',
      children: [{
        type: 'text',
        text: '请使用中/大尺寸',
        font: { size: 'callout' },
        textColor: '#FFFFFF'
      }]
    };
  }

  // 2. 中/大尺寸内容（文档DSL规范）
  return {
    type: 'widget',
    padding: 16,
    backgroundColor: '#1A1A2E',
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 8,
        children: [
          { type: 'image', src: 'sf-symbol:wifi', color: '#007AFF', width: 20, height: 20 },
          { type: 'text', text: '网络状态', font: { size: 'headline', weight: 'bold' }, textColor: '#FFFFFF' }
        ]
      },
      { type: 'spacer', length: 8 },
      {
        type: 'text',
        text: '✅ 脚本运行正常\n📶 等待添加功能',
        font: { size: 'subheadline' },
        textColor: '#AAAAAA',
        maxLines: 2
      }
    ]
  };
}
