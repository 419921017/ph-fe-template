'use strict';
const path = require('path');
const webpack = require('webpack');
const CompressionWebpackPlugin = require('compression-webpack-plugin');
const UselessFile = require('useless-files-webpack-plugin');
const WebpackBundleAnalyzer = require('webpack-bundle-analyzer');
const HappyPack = require('happypack');
const os = require('os');

const happyThreadPool = HappyPack.ThreadPool({ size: os.cpus().length });
const webpackConfig = require('./config/webpack.config.js');
const defaultSettings = require('./src/settings.js');

const resolve = dir => path.join(__dirname, dir);
const isProd = process.env.NODE_ENV === 'production';

const port = process.env.port || process.env.npm_config_port || 8888; // dev port

const name = defaultSettings.title || 'PH-FE-TEMPLATE'; // page title

// 开发模式代理地址, TODO: 按需修改
const DEV_URL = 'http://127.0.0.1';

// mock模式代理地址, TODO: 按需修改
const MOCK_URL = 'http://127.0.0.1';

module.exports = {
  // 不需要生产环境的 source map
  productionSourceMap: false,
  parallel: os.cpus().length > 1,
  lintOnSave: !isProd,
  publicPath: !isProd ? '/' : '',
  outputDir: 'dist',
  assetsDir: 'static',
  pwa: {
    iconPaths: {
      favicon32: 'favicon.icon',
      favicon16: 'favicon.icon',
      appleTouchIcon: 'favicon.icon',
      maskIcon: 'favicon.icon',
      msTileImage: 'favicon.icon'
    }
  },
  css: {
    // 是否将css 提取到独立的文件,生产环境提取，开发环境不提取
    extract: !!isProd,
    // 开发模式开启css sourcemap
    sourceMap: !isProd,
    loaderOptions: {
      less: {
        lessOptions: {
          modifyVars: {
            hack: 'true;@import "~@/style/_variables.less"'
          }
        }
      }
    }
  },
  // TODO: 按需设定
  devServer: {
    port: port,
    open: true,
    overlay: {
      warnings: false,
      errors: true
    },
    proxy: {
      '^/api': {
        target: DEV_URL,
        changeOrigin: true,
        headers: {
          Referer: DEV_URL
        },
        pathRewrite: {
          '^/api': ''
        }
      },
      '^/mock/': {
        // TODO: 添加 mock地址
        target: MOCK_URL,
        changeOrigin: true,
        headers: {
          Referer: DEV_URL
        },
        pathRewrite: {
          '^/mock': ''
        }
      }
    }
  },
  configureWebpack: {
    name: name,
    resolve: {
      alias: {
        '@': resolve('src'),
        '@src': resolve('src'),
        '@component': resolve('src/components'),
        '@router': resolve('src/router'),
        '@store': resolve('src/store'),
        '@views': resolve('src/views'),
        '@assets': resolve('src/assets')
      }
    },
    // 配置webpack 压缩
    plugins: [
      new CompressionWebpackPlugin({
        test: /\.js$|\.html$|\.css$/,
        // 超过4kb压缩
        threshold: 4096
      })
    ]
  },
  chainWebpack: config => {
    webpackConfig(config);

    // 多线程打包
    const jsRule = config.module.rule('js');
    jsRule.uses.clear();
    jsRule
      .use('happypack/loader?id=babel')
      .loader('happypack/loader?id=babel')
      .end();

    // config.plugins.push(
    //   new HappyPack({
    //     id: 'babel',
    //     loaders: ['babel-loader?cacheDirectory=true'],
    //     threadPool: happyThreadPool
    //   })
    // );
    config.plugin('HappyPack').use(
      new HappyPack({
        id: 'babel',
        loaders: ['babel-loader?cacheDirectory=true'],
        threadPool: happyThreadPool
      })
    );

    // 预览包大小
    process.env.ANALYZER &&
      config
        .plugin('webpack-bundle-analyzer')
        .use(WebpackBundleAnalyzer.BundleAnalyzerPlugin);

    config.plugin('preload').tap(() => [
      {
        rel: 'preload',
        // to ignore runtime.js
        // https://github.com/vuejs/vue-cli/blob/dev/packages/@vue/cli-service/lib/config/app.js#L171
        fileBlacklist: [/\.map$/, /hot-update\.js$/, /runtime\..*\.js$/],
        include: 'initial'
      }
    ]);

    // when there are many pages, it will cause too many meaningless requests
    isProd && config.plugins.delete('prefetch');
    isProd && config.plugins.delete('preload');

    config.module
      .rule('svg')
      .exclude.add(resolve('src/icons'))
      .end();

    config.module
      .rule('icons')
      .test(/\.svg$/)
      .include.add(resolve('src/icons'))
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]'
      })
      .end();

    config.when(isProd, config => {
      config
        .plugin('ScriptExtHtmlWebpackPlugin')
        .after('html')
        .use('script-ext-html-webpack-plugin', [
          {
            // `runtime` must same as runtimeChunk name. default is `runtime`
            inline: /runtime\..*\.js$/
          }
        ])
        .end();

      config.optimization.splitChunks({
        chunks: 'all',
        cacheGroups: {
          libs: {
            name: 'chunk-libs',
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            chunks: 'initial' // only package third parties that are initially dependent
          },
          elementUI: {
            name: 'chunk-elementUI', // split elementUI into a single package
            priority: 20, // the weight needs to be larger than libs and app or it will be packaged into libs or app
            test: /[\\/]node_modules[\\/]_?element-ui(.*)/ // in order to adapt to cnpm
          },
          commons: {
            name: 'chunk-commons',
            test: resolve('src/components'), // can customize your rules
            minChunks: 3, //  minimum common number
            priority: 5,
            reuseExistingChunk: true
          }
        }
      });

      config.plugin('uselessFile').use(
        new UselessFile({
          root: path.resolve(__dirname, './src/assets/images'),
          clean: true,
          exclude: /node_modules/
        })
      );

      // https:// webpack.js.org/configuration/optimization/#optimizationruntimechunk
      config.optimization.runtimeChunk('single');
    });
  }
};
