/**
 * @file: 图像预览节点执行器
 * @author: AutoMan
 * @date: 2025-07-31
 */

const execute = async (node, context) => {
  const { inputs } = node
  const { sendNodeEvent, complete, fs } = context

  try {
    let image = inputs.image
    //判断是否为buffer
    if (image && image instanceof Buffer) {
      image = 'data:image/png;base64,' + image.toString('base64')
    } else if (image && !image.startsWith('http') && !image.startsWith('data:image')) {
      // 本地路径需要转换为base64
      image = 'data:image/png;base64,' + fs.readFileSync(image, 'base64')
    }

    let compareImage = inputs.compareImage
    //判断是否为buffer
    if (compareImage && compareImage instanceof Buffer) {
      compareImage = 'data:image/png;base64,' + compareImage.toString('base64')
    } else if (
      compareImage &&
      !compareImage.startsWith('http') &&
      !compareImage.startsWith('data:image')
    ) {
      // 本地路径需要转换为base64
      compareImage = 'data:image/png;base64,' + fs.readFileSync(compareImage, 'base64')
    }

    if (!image && compareImage) {
      image = compareImage
      compareImage = ''
    }

    // 发送输出事件到渲染进程
    sendNodeEvent({
      type: 'preview',
      data: {
        image,
        compareImage
      }
    })

    complete()
  } catch (error) {
    throw error
  }
}

export default execute
