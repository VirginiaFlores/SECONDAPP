sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "../model/formatter"
], function (Controller, Filter, formatter) {
    "use strict";

    return Controller.extend("ns.project2.controller.productDetail", {

        formatter: formatter,

        // OData service models
        mainServiceModel: "mainServiceModel",

        // Data models
        businessPartnerModel: "BusinessPartnerModel",
        salesOrderModel:"SalesOrderModel",
        documentsModel: "DocumentsModel",

        // Odata entities
        mainEntity: "ProductSet",
        salesOrderEntity: "SalesOrderSet",

        onInit: function () {
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("productDetail").attachPatternMatched(this._onRouteMatched, this);
        },
        
        /**
		 * Event called when navigation to detail route is matched.
		 *
		 * @param {Object} oEvent event
		 */
        _onRouteMatched: async function (oEvent) {
            let productID = window.decodeURIComponent(oEvent.getParameter("arguments").ProductID);
            let businessPartnerData = await this._readBusinessPartnerData(productID);
            this._readSalesOrderData(businessPartnerData);            
        },

         /**
            * Retrieve information from backend OData using filters.
            * @param {array} filters Array of filters.
            */
         _readBusinessPartnerData: function (productID) {
            let resourceBundle = this.getView().getModel("i18n").getResourceBundle();
            let serviceModel;
            let filters = [];
            let that = this;

            return new Promise((resolve, reject) => {

                serviceModel = this.getView().getModel(this.mainServiceModel);

                let successFunction = function (oData) {
                    let businessPartnerResult = oData.results[0];
                    that.getView().getModel(that.businessPartnerModel).setData(businessPartnerResult.ToSupplier);    
                    that.getView().setBusy(false);
                    resolve(businessPartnerResult);
                };

                let errorFunction = function (error) {         
                    resourceBundle.getText("readDataError");
                    reject(error);  
                    that.getView().setBusy(false);
                };

                filters.push(new Filter("ProductID", sap.ui.model.FilterOperator.EQ, productID));

                this.getView().setBusy(true);
                serviceModel.read("/" + this.mainEntity, {
                    filters: filters,
                    urlParameters: {
                        $expand: "ToSupplier,ToSalesOrderLineItems",
                        $top: 5
                    },
                    and: true,
                    async: true,
                    success: successFunction,
                    error: errorFunction
                });
            });

        },

        /**
        * Retrieve information from backend OData using filters.
        * @param {array} filters Array of filters.
        */
        _readSalesOrderData: function (bpData) {
            let resourceBundle = this.getView().getModel("i18n").getResourceBundle();
            let serviceModel;
            let filters = [];
            let that = this;

            serviceModel = this.getView().getModel(this.mainServiceModel);

            let successFunction = function (oData) {
                let salesOrderResult = oData.results;
                let salesOrderData = [];
                let ToLineItemsData = [];

                for (let so of salesOrderResult) {

                    let toLineItems = so.ToLineItems.results;

                    for (let li of toLineItems) {
                        ToLineItemsData.push(
                            {
                                "SalesOrderID": li.SalesOrderID,
                                "Note": li.Note,
                                "ProductID": li.ProductID,
                                "Quantity": li.Quantity
                            }
                        );
                    }

                    salesOrderData.push(
                        {
                            "CustomerID": so.CustomerID,
                            "CustomerName": so.CustomerName,
                            "ToLineItems": ToLineItemsData
                        }
                    );
                }
                that.getView().getModel(that.salesOrderModel).setData(salesOrderData);
                that.getView().setBusy(false);
            };

            let errorFunction = function () {         
                resourceBundle.getText("readDataError");     
                that.getView().setBusy(false);
            };

            filters.push(new Filter("CustomerID", sap.ui.model.FilterOperator.EQ, bpData.SupplierID));

            this.getView().setBusy(true);
            serviceModel.read("/" + this.salesOrderEntity, {
                filters: filters,
                urlParameters: {
                    $expand: "ToLineItems",
                    $top: "5"
                },
                and: true,
                async: true,
                success: successFunction,
                error: errorFunction
            });

        },

        onBackProduct: function () {
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Routemain");  
        },

        /*
		 * Event fired when a file is loaded through the upload button.
		 * @param {object} oEvent event.
		 */
        onSelectFile: function (oEvent) {
            let files = oEvent.getParameter("files");
            this._loadFile(files);
        },
        /*
		 * Method that loads the file given a file object and shows a Dialog to select it's type and description.
		 * @param {array} files array of objects referencing the file selected by the user.
		 */
        _loadFile: function (files, oSource) {

            let that = this;
            let resourceBundle = this.getView().getModel("i18n").getResourceBundle();
            let maxFileSize = 10000000;
            let maxFileNameSize = 100;
            let file = files[0];

            if (files.length > 1) {
                MessageBox.error(resourceBundle.getText("onlyOneFileAllowed"));
                return;
            }

            if (file.size > maxFileSize) {
                MessageBox.error(resourceBundle.getText("fileSizeLimited", [maxFileSize]));
                return;
            }

            if (file.name.length > maxFileNameSize) {
                MessageBox.error(resourceBundle.getText("fileNameLimited", [maxFileNameSize]));
                return;
            }

            let reader = new FileReader();
            let sFileName = file.name;
            let fileContent;
            let base64Marker = "data:" + file.type + ";base64,";

            reader.onload = function (onLoadEvent) {

                let base64Index = onLoadEvent.target.result.indexOf(base64Marker) + base64Marker.length;
                let base64 = onLoadEvent.target.result.substring(base64Index);
                fileContent = base64;

                let data = {
                    fileName: sFileName,
                    fileContent: fileContent
                };

                //Unbinded data to loose the reference to the fileUploader value.
                that.dataToUpload = JSON.parse(JSON.stringify(data));

                if (oSource) {
                    //FileUploader value is reset.
                    oSource.setValue();
                }

                let oDialog = that._getFragment("newDocDialog", that.getView());

                sap.ui.getCore().byId("docDescription").setValue();
                oDialog.open();

            };
            reader.readAsDataURL(file);

        },

        /*
		* Event fired when pressed accept button of popup to select type of document and description to upload.
        * The method retrieves the data of the document selected and triggering the upload.
		* @param {object} oEvent event.
		*/
        onUploadSelectedButton: function (oEvent) {

            let that = this;
            let dialog = oEvent.getSource().getParent();
            let resourceBundle = this.getView().getModel("i18n").getResourceBundle();
            let description = sap.ui.getCore().byId("docDescription");
            description = description.getValue();
            let fileName = this.dataToUpload.fileName;
            let fileContent = this.dataToUpload.fileContent;

            if (!description) {
                MessageBox.error(resourceBundle.getText("errorDocDescriptionRequired"));
                return;
            }

            let data = {                
                "fileName": fileName,
                "fileContent": fileContent,
                "description": description,
                "createDate": new Date(),
                "createUser": "vflorest@ayesa.com"
            }

            dialog.close();
            that.getView().getModel(that.documentsModel).setData(data); 

        },

        /*
		* Event fired when pressed the cancel button on the load document dialog.
		* @param {object} oEvent event.
		*/
        onCancelUpload: function (oEvent) {
            let dialog = oEvent.getSource().getParent();
            this.dataToUpload = undefined;
            dialog.close();
        },

        /*
        * This functions searches if the fragment with the corresponding name is already created. If it's not, then it creates it
        * with the name "<fragmentName>_fragment".
        * 
        * @param {string} fragmentName String representing the name of the fragment's file.
        * @param {object} source Source context where that fragment should depend on (if NULL it will depend on the current view). 
        * @return {object} Fragment with the given name.
        */
        _getFragment: function (fragmentName, source) {

            if (!this[fragmentName + "_fragment"]) {
                this[fragmentName + "_fragment"] = sap.ui.xmlfragment("ns.project2.fragment." + fragmentName,
                    this);
            }

            if (source) {
                try {
                    source.addDependent(this[fragmentName + "_fragment"]); // genera una excepción
                } catch (err) {
                    // sentencias para manejar cualquier excepción
                    this[fragmentName + "_fragment"] = sap.ui.xmlfragment("ns.project2.fragment." + fragmentName,
                        this);
                    source.addDependent(this[fragmentName + "_fragment"]);
                }
            } else {
                try {
                    this.getView().addDependent(this[fragmentName + "_fragment"]); // genera una excepción
                } catch (err) {
                    // sentencias para manejar cualquier excepción
                    this[fragmentName + "_fragment"] = sap.ui.xmlfragment("ns.project2.fragment." + fragmentName,
                        this);
                    this.getView().addDependent(this[fragmentName + "_fragment"]);
                }
            }
            return this[fragmentName + "_fragment"];
        },
        /*
		 * Event fired when pressed the delete ticket document button.
		 * @param {object} oEvent event.
		 */
        onDeleteAnnex: function (oEvent) {
            this.getView().getModel(this.documentsModel).setData([]);           
        }
    });
});