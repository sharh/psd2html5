# Adobe（PS） CEP使用

## 一、`PS`有3种类型的扩展文件夹：

  1、产品自身扩展文件夹：建议是在此目录`${PP}/CEP/extensions `，但是各个产品自己会选择自己的安装目录。第三方扩展不能安装在此目录
  
  2、系统扩展文件夹：
  ```
  Win(x86): C:\Program Files\Common Files\Adobe\CEP\extensions
  Win(x64): C:\Program Files (x86)\Common Files\Adobe\CEP\extensions, and C:\Program Files\Common Files\Adobe\CEP\extensions (since CEP 6.1)
  Mac: /Library/Application Support/Adobe/CEP/extensions
  ```
  3、用户的扩展文件夹：
  ```
  Win: C:\Users\<USERNAME>\AppData\Roaming\Adobe\CEP/extensions
  Mac: ~/Library/Application Support/Adobe/CEP/extensions
  ```
> `CEP`加载扩展的机制：

1、搜索优先级：`产品目录`->`系统扩展目录`->`用户扩展目录`

2、没有明确的`产品应用ID`、`版本号`（ID和版本指`<HOST></HOST>`声明的内容）的扩展将被过滤掉

3、如果2个扩展程序有相同的`ID`，版本号高的将被加载

4、如果2个扩展程序有相同的`ID`和版本号，那么将加载`manifest.xml`修改最新的那个

5、如果第4条中的`manifest.xml`修改日期也一样，那么先找到谁就加载谁。

## 二、目录结构说明

```
/CSXS 必须且名称不能变，此目录下存放manifest.xml文件
/源文件目录 名称随意，只要在manifest.xml文件声明即可
/host ExtendScript的存放目录，即.jsx文件的存放目录.名称也是配置类型的
```

> 关于`.jsx`文件，可以直接在PS中执行：文件->脚本->浏览，选择`.jsx`文件即可执行。

> `.jsx`文件调试只能通过`Adobe ExtendScript Toolkit`来执行调试。

## 三、`manifest.xml`配置说明

```xml
<!-- 详细的XML说明见https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_8.x/ExtensionManifest_v_7_0.xsd -->
<?xml version='1.0' encoding='UTF-8'?>
<!-- ExtensionBundleId就是你的扩展插件的ID -->
<ExtensionManifest ExtensionBundleId="com.my.test" ExtensionBundleVersion="1.0.0" Version="7.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ExtensionList>
    <!-- 这里是扩展列表的名称，应该是一个ID下面可以有多个扩展程序 -->
    <Extension Id="com.my.test.panel" Version="1.0.0" />
  </ExtensionList>
  <ExecutionEnvironment>
    <HostList>
      <!-- 这里是产品名，以及对应支持的产品版本号， -->
      <!-- 关于Name和Version的值见https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_8.x/Documentation/CEP%208.0%20HTML%20Extension%20Cookbook.md#special-notes-for-mac-109-and-higher -->
      <!-- Version的值可以是区间，如[15, 19]表示支持15及以上版本和19及以下版本 -->
      <!-- 还有这种形式[15, 19)，跟数学的区间差不多意思 -->
      <Host Name="PHSP" Version="19" />
      <Host Name="PHXS" Version="19" />
    </HostList>
    <LocaleList>
      <!-- 语言 -->
      <Locale Code="All" />
    </LocaleList>
    <RequiredRuntimeList>
      <!-- 需要的运行时及版本号 -->
      <RequiredRuntime Name="CSXS" Version="7.0" />
    </RequiredRuntimeList>
  </ExecutionEnvironment>
  <DispatchInfoList>
    <!-- 打包信息 -->
    <Extension Id="com.my.test.panel">
      <DispatchInfo>
        <Resources>
          <!-- 主路径，入口文件的位置，相对根目录 -->
          <MainPath>./client/index.html</MainPath>
          <!-- 扩展文件目录 -->
          <ScriptPath>./host/index.jsx</ScriptPath>
          <!-- 命令行，可以配置参数，如启用nodejs -->
          <CEFCommandLine>
            <Parameter>--enable-nodejs</Parameter>
          </CEFCommandLine>
        </Resources>
        <Lifecycle>
          <AutoVisible>true</AutoVisible>
        </Lifecycle>
        <UI>
          <!-- UI显示时的类型 -->
          <!-- Panel/ModalDialog/Modeless/Custom/Embedded/Dashboard -->
          <!-- 详细见https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_8.x/Documentation/CEP%208.0%20HTML%20Extension%20Cookbook.md#debugging-unsigned-extensions -->
          <Type>Panel</Type>
          <!-- 在菜单上显示的名称 -->
          <Menu>My First Panel</Menu>
          <Geometry>
            <Size>
              <!-- 形状尺寸 -->
              <Height>500</Height>
              <Width>350</Width>
            </Size>
          </Geometry>
          <!-- 图标 -->
          <Icons />
        </UI>
      </DispatchInfo>
    </Extension>
  </DispatchInfoList>
</ExtensionManifest>
```

## 四、启用`Chrome`的远程调试

1、在扩展程序的根目录下新建`.debug`文件，注意这个文件是个XML文件，需要申明XML，不然无法启用`DEBUG`

2、文件内容：
```xml
<?xml version='1.0' encoding='UTF-8'?>
<ExtensionList>
<!-- 这里的ID跟CSXS目录下的manifest.xml中的“<Extension Id”必须一致 -->
  <Extension Id="com.example.helloworld.panel">
    <HostList>
      <!-- 这个是跟manifest.xml里面的HOST差不多，申明应用，以及应用下对应的端口号 -->
      <Host Name="PHXS" Port="8099" />
    </HostList>
  </Extension>
</ExtensionList>

```

3、设置产品开启调试模式。打开注册表，找到:

Win: `regedit > HKEY_CURRENT_USER/Software/Adobe/CSXS.9`

在该项中新建字符项(string)`PlayerDebugMode`设置值为1.

MACOS: 在命令行输入 `defaults write com.adobe.CSXS.9 PlayerDebugMode 1`
或者找到路径：`/Users/<username>/Library/Preferences/com.adobe.CSXS.9.plist`进行修改

> 注意: 这里的`CSXS.9`指的是产品版本号，根据安装的产品会显示相关的版本号，但是都是以`CSXS.`开头

3、重启PS，打开`窗口->扩展功能->插件名`，在`Chrome`中打开`http://localhost:8099`即可启动调试
