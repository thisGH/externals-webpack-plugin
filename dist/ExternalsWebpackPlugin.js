"use strict";
exports.__esModule = true;
exports.ExternalsWebpackPlugin = void 0;
var webpack_1 = require("webpack");
var HtmlWebpackPlugin = require("html-webpack-plugin");
var pluginName = "myExternal";
var ExternalsWebpackPlugin = /** @class */ (function () {
    function ExternalsWebpackPlugin(options) {
        // 分析依赖引入 保存代码中使用到需要转化为外部CDN的库
        this.usedLibrary = new Set();
        this.asyncUsedLibrary = new Set();
        // 保存参数
        this.options = options;
        // 保存参数传入的所有需要转化CDN外部externals的库名称
        this.transformLibrary = Object.keys(options);
    }
    ExternalsWebpackPlugin.prototype.apply = function (compiler) {
        var _this = this;
        compiler.hooks.normalModuleFactory.tap(pluginName, function (normalModuleFactory) {
            // 解析前
            normalModuleFactory.hooks.factorize.tap(pluginName, function (resolveData) {
                if (_this.usedLibrary.has(resolveData.request)) {
                    // console.log(
                    //     "\n externalModule:",
                    //     resolveData.request
                    // )
                    return new webpack_1.ExternalModule(_this.options[resolveData.request].variableName, "window", resolveData.request);
                }
                if (_this.asyncUsedLibrary.has(resolveData.request)) {
                    // console.log(
                    //     "\n externalModule:",
                    //     resolveData.request
                    // )
                    return new webpack_1.ExternalModule([
                        _this.options[resolveData.request].src,
                        _this.options[resolveData.request]
                            .variableName,
                    ], "script", resolveData.request);
                }
            });
            // ast分析
            normalModuleFactory.hooks.parser["for"]("javascript/auto")
                .tap(pluginName, function (parser) {
                // 当遇到模块引入语句 import 时
                _this.importHandler.call(_this, parser);
                // 当遇到模块引入语句 require 时
                _this.requireHandler.call(_this, parser);
            });
        });
        // 导入模块：HtmlWebpackPlugin插入script
        compiler.hooks.compilation.tap(pluginName, function (compilation) {
            // 获取HTMLWebpackPlugin拓展的compilation Hooks
            HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tap(pluginName, 
            // @ts-ignore
            function (data) {
                // 额外添加scripts
                var scriptTag = data.assetTags.scripts;
                // 同步模块
                _this.usedLibrary.forEach(function (library) {
                    // console.log("\n insertScript:", library)
                    scriptTag.unshift(HtmlWebpackPlugin.createHtmlTagObject("script", {
                        defer: false,
                        src: _this.options[library].src
                    }));
                });
                // 异步模块支持prefetch
                _this.asyncUsedLibrary.forEach(function (library) {
                    // console.log("\n insertLink:", library)
                    scriptTag.unshift(HtmlWebpackPlugin.createHtmlTagObject("script", {
                        defer: false,
                        type: "text/javascript"
                    }, "window.addEventListener(\"DOMContentLoaded\", function () {\n    var link = document.createElement(\"link\")\n    link.href = \"" + _this.options[library].src + "\"\n    link.as = \"script\"\n    link.rel = \"prefetch\"\n    document.head.appendChild(link)\n})"));
                });
            });
        });
    };
    ExternalsWebpackPlugin.prototype.importHandler = function (parser) {
        var _this = this;
        parser.hooks["import"].tap(pluginName, function (statement, source) {
            // 解析当前模块中的import语句
            if (_this.transformLibrary.includes(source)) {
                // console.log("\nimport:", source)
                _this.usedLibrary.add(source);
            }
        });
        parser.hooks.importCall.tap(pluginName, function (expression) {
            var moduleName = expression.source.value;
            // 解析当前模块中的import()语句
            if (_this.transformLibrary.includes(moduleName)) {
                // console.log("\nimportCall:", moduleName)
                _this.asyncUsedLibrary.add(moduleName);
            }
        });
    };
    ExternalsWebpackPlugin.prototype.requireHandler = function (parser) {
        var _this = this;
        // 解析当前模块中的require语句
        parser.hooks.call["for"]("require").tap(pluginName, function (expression) {
            var moduleName = expression.arguments[0].value;
            // console.log("\nrequire:", moduleName);
            // 当require语句中使用到传入的模块时
            if (_this.transformLibrary.includes(moduleName)) {
                _this.usedLibrary.add(moduleName);
            }
        });
    };
    return ExternalsWebpackPlugin;
}());
exports.ExternalsWebpackPlugin = ExternalsWebpackPlugin;
