# app

1、整个应用程序，比如我们只写了个`jsx?`，整个程序运行时就是app

2、`app.activeDocument`，当前激活的文档，如果有多个文件被打开的时候，这个对象就是当前正在编辑的文件

3、`app.activeDocument.activeLayer`，当前选中的图层

4、在`PS`中，图层对应的js对象是`artLayer`

5、`layerSets`表示文件夹组，即文件夹的集合

6、`layerSet`表示一个文件夹，里面可以有`artLayer`和`layerSets`。可以理解成电脑的硬盘的文件夹里面有文件，也有文件夹。**而这里的文件就是`PS`的`图层`，文件夹就是文件夹层**

7、裁切图层：

  1、由于`PS`未提供图层的保存接口，为此可以先裁切文档：
  ```javascript
  // 获取边界[left, top, right, bottom]
  var bounds = layer.bounds;
  // 裁切接口
  // app.activeDocument.crop(bounds, angle, width, height)
  // 裁切指定区域
  app.activeDocument.crop(bounds);
  // 导出文件
  app.activeDocument.exportDocument(File, ExportType, ExportOption)
  ```

  2、`File`是文件对象，通过`new File(path)`来构建

  3、`ExportType`是常量，可以选值为：`ExportType.SAVEFORWEB`导出为web类型，`ExportType.ILLUSTRATORPATHS`矢量类型

  4、`ExportOption`与`ExportType`对应。当`ExportType`为WEB类型时，`ExportOption`应该是`ExportOptionsSaveForWeb`的实例对象。当`ExportType`为矢量类型时，`ExportOption`应该是`ExportOptionsIllustrator`的实例对象

8、`$.fileName`表示当前`jsx?`文件的文件路径。