# psd2html5

在PS中将psd导出为html

# usage

1、Download `ExtendScript toolkit`, drag the `psd2h5.jsx` or `generate.jsx` to it, connect to photoshop2014 or later. Run the script.

2、Or open photoshop2014 or later, `file -> script -> browser`, select `psd2h5.jsx` or `generate.jsx`, it will automatic run the script.

3、When alert an error: `Can not save as web...`, do this:

```
1、关闭PS
2、打开注册表：regedit
3、打开路径：计算机\HKEY_CURRENT_USER\Software\Adobe\Photoshop\120.0
4、新建字符串值（DWORD类型）： 
名称：OverridePhysicalMemoryMB 
值（10进制）2000
5、保存
6、重新打开PS
```
4、动作监听器：

下载地址：
`http://download.adobe.com/pub/adobe/photoshop/win/13.x/Win_Scripting_Plug-In.zip`

或者搜索`Scripting_Plug-In`可以找到下载地址。

然后将下载的文件解压，注意将含有`Utilities`的文件夹名称改为为`Utilities`，然后放置到PS的安装目录下的`Plug-ins`目录

重启PS，随便操作一下PS，在桌面可以看到`ScriptingListenerJS`,这个文件里面会记录PS的动作