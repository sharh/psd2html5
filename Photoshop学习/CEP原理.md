# `CEP`的原理

## 文件结构

> 分3部分

1、配置文件，固定在根目录下的`/CSXS/manifest.xml`

2、`.debug`文件，联合`Chrome`进行插件界面调试，注意只能调试界面部分

3、插件界面文件。也就是html、js、css等这些文件

## 技术结构

> 分2部分

1、Web前端技术，主要是html+js+css。此处跟Web前端开发一样，但是部分API是被删掉的，不过一般不影响使用

2、`ExtendScript`即扩展脚本，可以直接在app中执行。这里定义的任何函数或者变量都可以通过`CSInterface`的`evalScript`来执行。Web与native通信，是通过`CSInterface`来执行`ExtendScript`脚本完成。

## 关系

1、`ExtendScript`可以理解成移动开发中的webview原生开发，可以向html5提供API。而html通过`evalScript`来调用原生提供的API

2、两者之间可以通过事件来进行通信。`CSInterface`的`addEventListener`监听到的就是`ExtendScript`发出的事件。

3、`ExtendScript`通过`new CSXSEvent()`来创建事件：
```javascript
var eventObj = new CSXSEvent(); 
eventObj.type="documentCreated"; 
eventObj.data="blahblah"; 
eventObj.dispatch();
```