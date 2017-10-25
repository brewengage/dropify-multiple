/*!
 * dropify-multiple - Override your input files with style. Supports mulitple file upload
 * @version v1.0.0
 * @link http://github.com/brewengage/dropify-multiple
 * @author Ravi Kannan <ravi@brewengage.com> (https://github.com/brewengage)
 * @contributors Jeremy FAGIS <jeremy@fagis.fr> (http://fagis.fr)
 * @contributors BrewEngage (added support for multi file upload)
 * @license MIT
 */

;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['jquery'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('jquery'));
  } else {
    root.DropifyMultiple = factory(root.jQuery);
  }
}(this, function($) {
var pluginName = "DropifyMultiple";

/**
 * Dropify plugin
 *
 * @param {Object} element
 * @param {Array} options
 */
function DropifyMultiple(element, options) {
    if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
        return;
    }

    var defaults = {
        defaultFile: '',
        maxFileSize: 0,
        minWidth: 0,
        maxWidth: 0,
        minHeight: 0,
        maxHeight: 0,
        showRemove: true,
        showLoader: true,
        showErrors: true,
        errorTimeout: 3000,
        errorsPosition: 'overlay',
        imgFileExtensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'],
        maxFileSizePreview: "5M",
        allowedFormats: ['portrait', 'square', 'landscape'],
        allowedFileExtensions: ['*'],
        messages: {
            'default': 'Drag and drop a file here or click',
            'replace': 'Drag and drop or click to replace',
            'remove':  'Remove',
            'error':   'Ooops, something wrong happended.'
        },
        error: {
            'fileSize': 'The file size is too big ({{ value }} max).',
            'minWidth': 'The image width is too small ({{ value }}}px min).',
            'maxWidth': 'The image width is too big ({{ value }}}px max).',
            'minHeight': 'The image height is too small ({{ value }}}px min).',
            'maxHeight': 'The image height is too big ({{ value }}px max).',
            'imageFormat': 'The image format is not allowed ({{ value }} only).',
            'fileExtension': 'The file is not allowed ({{ value }} only).'
        },
        tpl: {
            wrap:            '<div class="dropify-wrapper"></div>',
            loader:          '<div class="dropify-loader"></div>',
            message:         '<div class="dropify-message"><span class="file-icon" /> <p>{{ default }}</p></div>',
            preview:         '<div class="dropify-preview"><span class="dropify-render"></span><div class="dropify-infos"><div class="dropify-infos-inner"><p class="dropify-infos-message">{{ replace }}</p></div></div></div>',
            filename:        '<p class="dropify-filename"><span class="dropify-filename-inner"></span></p>',
            clearButton:     '<button type="button" class="dropify-clear">{{ remove }}</button>',
            errorLine:       '<p class="dropify-error">{{ error }}</p>',
            errorsContainer: '<div class="dropify-errors-container"><ul></ul></div>'
        }
    };
    this.element            = element;
    this.input              = $(this.element);
    this.wrapper            = null;
    this.preview            = null;
    this.filenameWrapper    = null;
    this.settings           = $.extend(true, defaults, options, this.input.data());
    this.errorsEvent        = $.Event('dropify.errors');
    this.isDisabled         = false;
    this.isInit             = false;
    this.droppedFile               = {
        object: null,
        name: null,
        size: null,
        width: null,
        height: null,
        type: null
    };
    this.files              = [];  // array of droppedFile
    this.totalFiles         = 0;   // number of files dropped

    if (!Array.isArray(this.settings.allowedFormats)) {
        this.settings.allowedFormats = this.settings.allowedFormats.split(' ');
    }

    if (!Array.isArray(this.settings.allowedFileExtensions)) {
        this.settings.allowedFileExtensions = this.settings.allowedFileExtensions.split(' ');
    }

    this.onChange     = this.onChange.bind(this);
    this.clearElement = this.clearElement.bind(this);
    this.onFileReady  = this.onFileReady.bind(this);

    this.translateMessages();
    this.createElements();
    this.setContainerSize();

    this.errorsEvent.errors = [];

    this.input.on('change', this.onChange);
}

/**
 * On change event
 */
DropifyMultiple.prototype.onChange = function()
{
    this.resetFile();
    this.resetPreview();
    this.readFile(this.element);
};

/**
 * Create dom elements
 */
DropifyMultiple.prototype.createElements = function()
{
    this.isInit = true;
    this.input.wrap($(this.settings.tpl.wrap));
    this.wrapper = this.input.parent();

    var messageWrapper = $(this.settings.tpl.message).insertBefore(this.input);
    $(this.settings.tpl.errorLine).appendTo(messageWrapper);

    if (this.isTouchDevice() === true) {
        this.wrapper.addClass('touch-fallback');
    }

    if (this.input.attr('disabled')) {
        this.isDisabled = true;
        this.wrapper.addClass('disabled');
    }

    if (this.settings.showLoader === true) {
        this.loader = $(this.settings.tpl.loader);
        this.loader.insertBefore(this.input);
    }

    this.preview = $(this.settings.tpl.preview);
    this.preview.insertAfter(this.input);

    if (this.isDisabled === false && this.settings.showRemove === true) {
        this.clearButton = $(this.settings.tpl.clearButton);
        this.clearButton.insertAfter(this.input);
        this.clearButton.on('click', this.clearElement);
    }

    this.filenameWrapper = $(this.settings.tpl.filename);
    this.filenameWrapper.prependTo(this.preview.find('.dropify-infos-inner'));

    if (this.settings.showErrors === true) {
        this.errorsContainer = $(this.settings.tpl.errorsContainer);

        if (this.settings.errorsPosition === 'outside') {
            this.errorsContainer.insertAfter(this.wrapper);
        } else {
            this.errorsContainer.insertBefore(this.input);
        }
    }

    var defaultFile = this.settings.defaultFile || '';

    if (defaultFile.trim() !== '') {
        var f = this.cleanFilename(defaultFile);
        this.setPreview(this.isImage(f), defaultFile, defaultfile.name);
    }
};

/**
 * Read the file using FileReader
 *
 * @param  {Object} input
 */
DropifyMultiple.prototype.readFile = function(input)
{

    // number of files dropped for upload in the input box
    var j = input.files.length; 
    var filesArrayLength = this.totalFiles;

    // set the new total no of file dropped, existing plus new ones
    this.totalFiles += j;

    if (this.totalFiles == 1)
    { // set the dropify hover info
        this.filenameWrapper.children('.dropify-filename-inner').html(input.files[0].name);
    }
    else
    {
        var msg = this.totalFiles + " files to upload.";
        this.filenameWrapper.children('.dropify-filename-inner').html(msg);       
    }

    if (j)
    { // if there are files to upload
        var eventFileReady = $.Event("dropify.fileReady");

        // important to switch off jquery event to avoid multiple triggers. Issue with Jquery click event.
        this.input.off('dropify.fileReady', this.onFileReady);

        // set an event to handle display when file is ready.
        this.input.on('dropify.fileReady', this.onFileReady);
    }        

    // read and process multiple files
    for( var i=0; i < j; i++ ) {
        var reader         = new FileReader();
        var file           = input.files[i];
        var _this          = this;
        var fileIndex      = i+filesArrayLength;

        this.clearErrors();
        this.showLoader();

        // add files to our file array
        this.setFileInformations(file, fileIndex);

        this.errorsEvent.errors = [];
        this.checkFileSize(file.size);
		this.isFileExtensionAllowed(file.name);

        if (this.isImage(file.name) && file.size < this.sizeToByte(this.settings.maxFileSizePreview)) 
        {

            reader.readAsDataURL(file);
            reader.onload =  (function (file) {
                return function (_file) {
                    var image = new Image();

                    // set file name to image name and title
                    image.name  = file.name;
                    image.title = file.name;
                    
                    // set image soure from reader
                    image.src   = _file.target.result;

                    image.onload = function () {
                        // get the files array index for the image file
                        var fIndex = _this.findFileIndexBasedOnName(this.name);

                        _this.setFileDimensions(this.width, this.height, fIndex);
                        _this.validateImage(fIndex);
                        console.log("image.onload:", fIndex, " - ", this.name);
                        _this.input.trigger(eventFileReady, [true, this]);
                    };
                }.bind(this);
            })(file);
        } 
        else 
        {
            this.onFileReady(false);
        }
    }
};

/**
 * On file ready to show
 *
 * @param  {Event} event
 * @param  {Bool} previewable
 * @param  {String} src
 */
DropifyMultiple.prototype.onFileReady = function(event, previewable, img)
{
    var fileIndex = -1;

    if (this.errorsEvent.errors.length === 0) {
        fileIndex = this.findFileIndexBasedOnName(img.name);
        if (fileIndex >=0)
            this.setPreview(previewable, img.src, img.name);
    } else {
        this.input.trigger(this.errorsEvent, [this]);
        for (var i = this.errorsEvent.errors.length - 1; i >= 0; i--) {
            var errorNamespace = this.errorsEvent.errors[i].namespace;
            var errorKey = errorNamespace.split('.').pop();
            this.showError(errorKey);
        }

        if (typeof this.errorsContainer !== "undefined") {
            this.errorsContainer.addClass('visible');

            var errorsContainer = this.errorsContainer;
            setTimeout(function(){ errorsContainer.removeClass('visible'); }, this.settings.errorTimeout);
        }

        this.wrapper.addClass('has-error');
        this.resetPreview();
        this.clearElement();
    }
};

/**
 * Set file informations
 *
 * @param {File} file
 */
DropifyMultiple.prototype.setFileInformations = function(file, fileIndex)
{
    // check of array element exists
    if (typeof this.files[fileIndex] == 'undefined')
    {
        // add an empty object to files array
        this.files.push({});
    }

    // copy values from the passed in file object
    this.files[fileIndex].object = file;
    this.files[fileIndex].name   = file.name;
    this.files[fileIndex].size   = file.size;
    this.files[fileIndex].type   = file.type;
    this.files[fileIndex].width  = null;
    this.files[fileIndex].height = null;
};

/**
 * Set file dimensions
 *
 * @param {Int} width
 * @param {Int} height
 */
DropifyMultiple.prototype.setFileDimensions = function(width, height, fileIndex)
{
    if (fileIndex >=0 )
    {
        this.files[fileIndex].width  = width;
        this.files[fileIndex].height = height;
    }
};

DropifyMultiple.prototype.findFileIndexBasedOnName = function(name) 
{
    for ( var i=0; i < this.files.length; i++)
    {
        if (this.files[i].name == name)
            return i;
    }
    return -1;
};

/**
 * Set the preview and animate it
 *
 * @param {String} src
 */
DropifyMultiple.prototype.setPreview = function(previewable, src, fileName)
{
    this.wrapper.removeClass('has-error').addClass('has-preview');    
    var render = this.preview.children('.dropify-render');

    //console.log(" filename: ", fileName);
    this.hideLoader();

    if (previewable === true) {
        var imgTag = $('<img />').attr('src', src);

        if (this.settings.height) {
            imgTag.css("max-height", this.settings.height);
        }

        imgTag.appendTo(render);
    } else {
        $('<i />').attr('class', 'dropify-font-file').appendTo(render);
        $('<span class="dropify-extension" />').html(this.getFileType()).appendTo(render);
    }
    this.preview.fadeIn();
};

/**
 * Reset the preview
 */
DropifyMultiple.prototype.resetPreview = function()
{
    this.wrapper.removeClass('has-preview');
    var render = this.preview.children('.dropify-render');
    render.find('.dropify-extension').remove();
    render.find('i').remove();
    render.find('img').remove();
    this.preview.hide();
    this.hideLoader();
};

/**
 * Clean the src and get the filename
 *
 * @param  {String} src
 *
 * @return {String} filename
 */
DropifyMultiple.prototype.cleanFilename = function(src)
{
    var filename = src.split('\\').pop();
    if (filename == src) {
        filename = src.split('/').pop();
    }

    return src !== "" ? filename : '';
};

/**
 * Clear the element, events are available
 */
DropifyMultiple.prototype.clearElement = function()
{
    if (this.errorsEvent.errors.length === 0) {
        var eventBefore = $.Event("dropify.beforeClear");
        this.input.trigger(eventBefore, [this]);

        if (eventBefore.result !== false) {
            this.resetFile();
            this.input.val('');
            this.resetPreview();

            this.input.trigger($.Event("dropify.afterClear"), [this]);
        }
    } else {
        this.resetFile();
        this.input.val('');
        this.resetPreview();
    }
};

/**
 * Reset file informations
 */
Dropify.prototype.resetFile = function()
{
    // free all the loaded file data to free up memory
    for ( var i = this.files.length; i >= 0; i--) 
    {
        this.files[i] = null;
        this.files.pop();
    }

    this.totalFiles = 0; // reset filecount
};

/**
 * Set the container height
 */
DropifyMultiple.prototype.setContainerSize = function()
{
    if (this.settings.height) {
        this.wrapper.height(this.settings.height);
    }
};

/**
 * Test if it's touch screen
 *
 * @return {Boolean}
 */
DropifyMultiple.prototype.isTouchDevice = function()
{
    return (('ontouchstart' in window) ||
            (navigator.MaxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
};

/**
 * Get the file type.
 *
 * @return {String}
 */
DropifyMultiple.prototype.getFileType = function(fileName)
{
    return fileName.split('.').pop().toLowerCase();
};

/**
 * Test if the file is an image
 *
 * @return {Boolean}
 */
DropifyMultiple.prototype.isImage = function(fileName)
{
    if (this.settings.imgFileExtensions.indexOf(this.getFileType(fileName)) != "-1") {
        return true;
    }

    return false;
};

/**
* Test if the file extension is allowed
*
* @return {Boolean}
*/
DropifyMultiple.prototype.isFileExtensionAllowed = function (fileName) {

	if (this.settings.allowedFileExtensions.indexOf('*') != "-1" || 
        this.settings.allowedFileExtensions.indexOf(this.getFileType(fileName)) != "-1") {
		return true;
	}
	this.pushError("fileExtension");

	return false;
};

/**
 * Translate messages if needed.
 */
DropifyMultiple.prototype.translateMessages = function()
{
    for (var name in this.settings.tpl) {
        for (var key in this.settings.messages) {
            this.settings.tpl[name] = this.settings.tpl[name].replace('{{ ' + key + ' }}', this.settings.messages[key]);
        }
    }
};

/**
 * Check the limit filesize.
 */
DropifyMultiple.prototype.checkFileSize = function(fSize)
{
    if (this.sizeToByte(this.settings.maxFileSize) !== 0 && fSize > this.sizeToByte(this.settings.maxFileSize)) {
        this.pushError("fileSize");
    }
};

/**
 * Convert filesize to byte.
 *
 * @return {Int} value
 */
DropifyMultiple.prototype.sizeToByte = function(size)
{
    var value = 0;

    if (size !== 0) {
        var unit  = size.slice(-1).toUpperCase(),
            kb    = 1024,
            mb    = kb * 1024,
            gb    = mb * 1024;

        if (unit === 'K') {
            value = parseFloat(size) * kb;
        } else if (unit === 'M') {
            value = parseFloat(size) * mb;
        } else if (unit === 'G') {
            value = parseFloat(size) * gb;
        }
    }

    return value;
};

/**
 * Validate image dimensions and format
 */
DropifyMultiple.prototype.validateImage = function(fileIndex)
{
    // get the droppedfile object
    var fObj = this.files[fileIndex];

    if (this.settings.minWidth !== 0 && this.settings.minWidth >= fObj.width) {
        this.pushError("minWidth");
    }

    if (this.settings.maxWidth !== 0 && this.settings.maxWidth <= fObj.width) {
        this.pushError("maxWidth");
    }

    if (this.settings.minHeight !== 0 && this.settings.minHeight >= fObj.height) {
        this.pushError("minHeight");
    }

    if (this.settings.maxHeight !== 0 && this.settings.maxHeight <= fObj.height) {
        this.pushError("maxHeight");
    }

    if (this.settings.allowedFormats.indexOf(this.getImageFormat(fObj)) == "-1") {
        this.pushError("imageFormat");
    }
};

/**
 * Get image format.
 *
 * @return {String}
 */
DropifyMultiple.prototype.getImageFormat = function(fileObject)
{
    if (fileObject.width == fileObject.height) {
        return "square";
    }

    if (fileObject.width < fileObject.height) {
        return "portrait";
    }

    if (fileObject.width > fileObject.height) {
        return "landscape";
    }
};

/**
* Push error
*
* @param {String} errorKey
*/
DropifyMultiple.prototype.pushError = function(errorKey) {
    var e = $.Event("dropify.error." + errorKey);
    this.errorsEvent.errors.push(e);
    this.input.trigger(e, [this]);
};

/**
 * Clear errors
 */
DropifyMultiple.prototype.clearErrors = function()
{
    if (typeof this.errorsContainer !== "undefined") {
        this.errorsContainer.children('ul').html('');
    }
};

/**
 * Show error in DOM
 *
 * @param  {String} errorKey
 */
DropifyMultiple.prototype.showError = function(errorKey)
{
    if (typeof this.errorsContainer !== "undefined") {
        this.errorsContainer.children('ul').append('<li>' + this.getError(errorKey) + '</li>');
    }
};

/**
 * Get error message
 *
 * @return  {String} message
 */
DropifyMultiple.prototype.getError = function(errorKey)
{
    var error = this.settings.error[errorKey],
        value = '';

    if (errorKey === 'fileSize') {
        value = this.settings.maxFileSize;
    } else if (errorKey === 'minWidth') {
        value = this.settings.minWidth;
    } else if (errorKey === 'maxWidth') {
        value = this.settings.maxWidth;
    } else if (errorKey === 'minHeight') {
        value = this.settings.minHeight;
    } else if (errorKey === 'maxHeight') {
        value = this.settings.maxHeight;
    } else if (errorKey === 'imageFormat') {
        value = this.settings.allowedFormats.join(', ');
    } else if (errorKey === 'fileExtension') {
		value = this.settings.allowedFileExtensions.join(', ');
	}

    if (value !== '') {
        return error.replace('{{ value }}', value);
    }

    return error;
};

/**
 * Show the loader
 */
DropifyMultiple.prototype.showLoader = function()
{
    if (typeof this.loader !== "undefined") {
        this.loader.show();
    }
};

/**
 * Hide the loader
 */
DropifyMultiple.prototype.hideLoader = function()
{
    if (typeof this.loader !== "undefined") {
        this.loader.hide();
    }
};

/**
 * Destroy dropify
 */
DropifyMultiple.prototype.destroy = function()
{
    this.input.siblings().remove();
    this.input.unwrap();
    this.isInit = false;
};

/**
 * Init dropify
 */
DropifyMultiple.prototype.init = function()
{
    this.createElements();
};

/**
 * Test if element is init
 */
DropifyMultiple.prototype.isDropified = function()
{
    return this.isInit;
};

$.fn[pluginName] = function(options) {
    this.each(function() {
        if (!$.data(this, pluginName)) {
            $.data(this, pluginName, new Dropify(this, options));
        }
    });

    return this;
};

return DropifyMultiple;
}));
