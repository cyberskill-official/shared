/**
 * Module declaration for CSS modules with .module.css extension.
 */
declare module '*.module.css' {
    const style: { [className: string]: string };
    export default style;
}

/**
 * Module declaration for plain CSS files.
 */
declare module '*.css' { }

/**
 * Module declaration for SCSS modules with .module.scss extension.
 */
declare module '*.module.scss' {
    const style: { [className: string]: string };
    export default style;
}

/**
 * Module declaration for plain SCSS files.
 */
declare module '*.scss' { }
