import { Compiler, ExternalModule } from "webpack"
import * as HtmlWebpackPlugin from "html-webpack-plugin"

interface PluginArgs {
    [key: string]: {
        src: string
        variableName: string
    }
}

const pluginName = "myExternal"

class ExternalsWebpackPlugin {
    options: PluginArgs
    transformLibrary: string[]
    // 分析依赖引入 保存代码中使用到需要转化为外部CDN的库
    usedLibrary: Set<string> = new Set()
    asyncUsedLibrary: Set<string> = new Set()
    constructor(options: PluginArgs) {
        // 保存参数
        this.options = options
        // 保存参数传入的所有需要转化CDN外部externals的库名称
        this.transformLibrary = Object.keys(options)
    }

    apply(compiler: Compiler) {
        compiler.hooks.normalModuleFactory.tap(
            pluginName,
            (normalModuleFactory) => {
                // 解析前
                normalModuleFactory.hooks.factorize.tap(
                    pluginName,
                    (resolveData) => {
                        if (this.usedLibrary.has(resolveData.request)) {
                            // console.log(
                            //     "\n externalModule:",
                            //     resolveData.request
                            // )
                            return new ExternalModule(
                                this.options[resolveData.request].variableName,
                                "window",
                                resolveData.request
                            )
                        }
                        if (this.asyncUsedLibrary.has(resolveData.request)) {
                            // console.log(
                            //     "\n externalModule:",
                            //     resolveData.request
                            // )
                            return new ExternalModule(
                                [
                                    this.options[resolveData.request].src,
                                    this.options[resolveData.request]
                                        .variableName,
                                ],
                                "script",
                                resolveData.request
                            )
                        }
                    }
                )
                // ast分析
                normalModuleFactory.hooks.parser
                    .for("javascript/auto")
                    .tap(pluginName, (parser) => {
                        // 当遇到模块引入语句 import 时
                        this.importHandler.call(this, parser)
                        // 当遇到模块引入语句 require 时
                        this.requireHandler.call(this, parser)
                    })
            }
        )

        // 导入模块：HtmlWebpackPlugin插入script
        compiler.hooks.compilation.tap(pluginName, (compilation) => {
            // 获取HTMLWebpackPlugin拓展的compilation Hooks
            HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tap(
                pluginName,
                // @ts-ignore
                (data) => {
                    // 额外添加scripts
                    const scriptTag = data.assetTags.scripts

                    // 同步模块
                    this.usedLibrary.forEach((library) => {
                        // console.log("\n insertScript:", library)
                        scriptTag.unshift(
                            HtmlWebpackPlugin.createHtmlTagObject("script", {
                                defer: false,
                                src: this.options[library].src,
                            })
                        )
                    })
                    // 异步模块支持prefetch
                    this.asyncUsedLibrary.forEach((library) => {
                        // console.log("\n insertLink:", library)
                        scriptTag.unshift(
                            HtmlWebpackPlugin.createHtmlTagObject(
                                "script",
                                {
                                    defer: false,
                                    type: "text/javascript",
                                },
                                `window.addEventListener("DOMContentLoaded", function () {
    var link = document.createElement("link")
    link.href = "${this.options[library].src}"
    link.as = "script"
    link.rel = "prefetch"
    document.head.appendChild(link)
})`
                            )
                        )
                    })
                }
            )
        })
    }
    importHandler(parser) {
        parser.hooks.import.tap(pluginName, (statement, source) => {
            // 解析当前模块中的import语句
            if (this.transformLibrary.includes(source)) {
                // console.log("\nimport:", source)
                this.usedLibrary.add(source)
            }
        })
        parser.hooks.importCall.tap(pluginName, (expression) => {
            const moduleName = expression.source.value
            // 解析当前模块中的import()语句
            if (this.transformLibrary.includes(moduleName)) {
                // console.log("\nimportCall:", moduleName)
                this.asyncUsedLibrary.add(moduleName)
            }
        })
    }
    requireHandler(parser) {
        // 解析当前模块中的require语句
        parser.hooks.call.for("require").tap(pluginName, (expression) => {
            const moduleName = expression.arguments[0].value
            // console.log("\nrequire:", moduleName);
            // 当require语句中使用到传入的模块时
            if (this.transformLibrary.includes(moduleName)) {
                this.usedLibrary.add(moduleName)
            }
        })
    }
}

export { ExternalsWebpackPlugin }
