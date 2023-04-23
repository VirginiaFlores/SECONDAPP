sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter"
], function (Controller, Filter) {
    "use strict";

    return Controller.extend("ns.project2.controller.productDetail", {

        // OData service models
        mainServiceModel: "mainServiceModel",

        // Data models
        businessPartnerModel: "BusinessPartnerModel",
        salesOrderModel:"SalesOrderModel",

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
        }

    });
});